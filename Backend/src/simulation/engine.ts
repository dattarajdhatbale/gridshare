import prisma from '../db/prismaClient';
import { simulateMetersForTick, lmpFor } from './simulator';
import { optimizeTrades } from './matching';
import { Meter, Trade } from './model';
import { WebSocket } from 'ws';

class SimulationEngine {
  private intervalId: NodeJS.Timeout | null = null;
  private wsClients: Set<WebSocket> = new Set();

  public registerClient(ws: WebSocket) {
    this.wsClients.add(ws);
    ws.on('close', () => this.wsClients.delete(ws));
    // Send current state to newly connected client
    this.sendCurrentStateToClient(ws);
  }

  public broadcast(data: any) {
    const payload = JSON.stringify(data);
    for (const client of this.wsClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  public async start() {
    const state = await prisma.simulationState.findUnique({ where: { id: 1 } });
    if (!state) return;

    if (state.playing) {
      this.startTimer(state.speed);
    }
  }

  private startTimer(speed: string) {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    const ms = speed === '4x' ? 250 : speed === '2x' ? 500 : 1000;
    this.intervalId = setInterval(() => this.tick(), ms);
  }

  private stopTimer() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public async setControl(playing?: boolean, speed?: string) {
    let state = await prisma.simulationState.findUnique({ where: { id: 1 } });
    if (!state) return;

    const nextPlaying = playing !== undefined ? playing : state.playing;
    const nextSpeed = speed !== undefined ? speed : state.speed;

    state = await prisma.simulationState.update({
      where: { id: 1 },
      data: {
        playing: nextPlaying,
        speed: nextSpeed,
      },
    });

    if (nextPlaying) {
      this.startTimer(nextSpeed);
    } else {
      this.stopTimer();
    }

    // Broadcast state update
    await this.broadcastState();
  }

  public async forceTick(targetTick: number) {
    let state = await prisma.simulationState.findUnique({ where: { id: 1 } });
    if (!state) return;

    state = await prisma.simulationState.update({
      where: { id: 1 },
      data: { tick: targetTick },
    });

    // Run a simulation step for this tick (saves reading, matching, ledger updates)
    await this.runSimulationStep(targetTick);
  }

  private async tick() {
    let state = await prisma.simulationState.findUnique({ where: { id: 1 } });
    if (!state) return;

    const nextTick = (state.tick + 1) % 96;
    await prisma.simulationState.update({
      where: { id: 1 },
      data: { tick: nextTick },
    });

    await this.runSimulationStep(nextTick);
  }

  private async runSimulationStep(tick: number) {
    // 1. Fetch current database states
    const dbMeters = await prisma.meter.findMany();
    const state = await prisma.simulationState.findUnique({ where: { id: 1 } });
    if (!state) return;

    // 2. Compute physics (generation and load)
    const simulatedMeters = simulateMetersForTick(tick, dbMeters);

    // 3. Resolve market trading clearing
    const trades = optimizeTrades(simulatedMeters);

    // 4. Update the DB: accumulate savings, ledger, counterparties, and baseline utility
    let tickBaseline = 0;
    const meterEarningsUpdate: Record<string, { earned: number; partner: string }> = {};

    trades.forEach((t) => {
      tickBaseline += t.kwh * 4.00;

      const seller = simulatedMeters.find((m) => m.name === t.seller || m.id === t.seller);
      const buyer = simulatedMeters.find((m) => m.name === t.buyer || m.id === t.buyer);

      if (seller) {
        const gain = t.sent * (t.energyPrice - 4.00);
        if (!meterEarningsUpdate[seller.id]) {
          meterEarningsUpdate[seller.id] = { earned: 0, partner: '' };
        }
        meterEarningsUpdate[seller.id].earned += gain;
        if (buyer) {
          meterEarningsUpdate[seller.id].partner = buyer.id;
        }
      }

      if (buyer) {
        const saving = t.delivered * (7.00 - t.buyerUnitPrice);
        if (!meterEarningsUpdate[buyer.id]) {
          meterEarningsUpdate[buyer.id] = { earned: 0, partner: '' };
        }
        meterEarningsUpdate[buyer.id].earned += saving;
        if (seller) {
          meterEarningsUpdate[buyer.id].partner = seller.id;
        }
      }
    });

    // Write increments to database
    await prisma.$transaction(async (tx) => {
      // Update cumulative baseline
      await tx.simulationState.update({
        where: { id: 1 },
        data: {
          cumulativeBaseline: {
            increment: tickBaseline,
          },
        },
      });

      // Update individual meters
      for (const meterId of Object.keys(meterEarningsUpdate)) {
        const update = meterEarningsUpdate[meterId];
        const m = dbMeters.find((x) => x.id === meterId);
        if (m) {
          const currentPartners = m.sharedPartners ? m.sharedPartners.split(',') : [];
          if (update.partner && !currentPartners.includes(update.partner)) {
            currentPartners.push(update.partner);
          }
          await tx.meter.update({
            where: { id: meterId },
            data: {
              earned: { increment: update.earned },
              sharedPartners: currentPartners.join(','),
            },
          });
        }
      }

      // Log meter readings
      for (const m of simulatedMeters) {
        await tx.meterReading.create({
          data: {
            tick,
            meterId: m.id,
            generation: m.generation,
            load: m.load,
            exportKWh: m.exportKWh,
            importKWh: m.importKWh,
            voltage: m.voltage,
            current: m.current,
            powerFactor: m.powerFactor,
          },
        });
      }

      // Log trades
      for (const t of trades) {
        await tx.trade.create({
          data: {
            id: `${t.id}-${tick}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            tick,
            buyer: t.buyer,
            seller: t.seller,
            sent: t.sent,
            delivered: t.delivered,
            lossKWh: t.lossKWh,
            distance: t.distance,
            lossFrac: t.lossFrac,
            nCharge: t.nCharge,
            energyPrice: t.energyPrice,
            buyerUnitPrice: t.buyerUnitPrice,
            buyerPayment: t.buyerPayment,
            sellerRevenue: t.sellerRevenue,
            networkRevenue: t.networkRevenue,
          },
        });
      }
    });

    // Broadcast updated state
    await this.broadcastState();
  }

  public async reset() {
    this.stopTimer();

    // 1. Reset simulation configs
    await prisma.simulationState.update({
      where: { id: 1 },
      data: {
        tick: 62,
        playing: true,
        speed: '1x',
        cumulativeBaseline: 0.0,
      },
    });

    // 2. Reset meter parameters
    await prisma.meter.updateMany({
      data: {
        earned: 0.0,
        sharedPartners: '',
      },
    });

    // 3. Delete logs
    await prisma.meterReading.deleteMany({});
    await prisma.trade.deleteMany({});

    this.startTimer('1x');
    await this.broadcastState();
  }

  public async broadcastState() {
    const payload = await this.getCurrentStatePayload();
    this.broadcast(payload);
  }

  private async sendCurrentStateToClient(ws: WebSocket) {
    const payload = await this.getCurrentStatePayload();
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  public async getCurrentStatePayload() {
    const state = await prisma.simulationState.findUnique({ where: { id: 1 } });
    const dbMeters = await prisma.meter.findMany();

    if (!state) return {};

    // Get current tick parameters
    const simulatedMeters = simulateMetersForTick(state.tick, dbMeters);
    const trades = optimizeTrades(simulatedMeters);

    // Build ledger maps
    const ledger: Record<string, number> = {};
    const sharedPartners: Record<string, string[]> = {};

    dbMeters.forEach((m) => {
      ledger[m.id] = m.earned;
      sharedPartners[m.id] = m.sharedPartners ? m.sharedPartners.split(',') : [];
    });

    return {
      tick: state.tick,
      playing: state.playing,
      speed: state.speed,
      cumulativeBaseline: state.cumulativeBaseline,
      meters: simulatedMeters,
      trades: trades,
      ledger,
      sharedPartners,
    };
  }
}

export const engine = new SimulationEngine();
