import prisma from '../db/prismaClient';
import { simulateMetersForTick, lmpFor } from './simulator';
import { optimizeTrades } from './matching';
import { Meter, Trade, PFIT, PGRID } from './model';
import { WebSocket } from 'ws';
import { resolveSession } from '../auth/session';
import { scopeStatePayload } from './scope';

const defaultSeedMeters = [
  { id: 'M-01', name: 'Asha Solar', role: 'solar', pv: 4.8, baseLoad: 1.7, distance: 0 },
  { id: 'M-02', name: 'Ravi Home', role: 'consumer', pv: 0.0, baseLoad: 3.4, distance: 120 },
  { id: 'M-03', name: 'Meera House', role: 'prosumer', pv: 3.9, baseLoad: 2.0, distance: 180 },
  { id: 'M-04', name: 'Ananya Villa', role: 'solar', pv: 5.2, baseLoad: 1.6, distance: 250 },
  { id: 'M-05', name: 'Kabir Home', role: 'consumer', pv: 0.0, baseLoad: 2.7, distance: 310 },
  { id: 'M-06', name: 'Ishita Flat', role: 'prosumer', pv: 2.8, baseLoad: 2.1, distance: 380 },
  { id: 'M-07', name: 'Nikhil Home', role: 'consumer', pv: 0.0, baseLoad: 2.4, distance: 460 },
  { id: 'M-08', name: 'Tara Solar', role: 'solar', pv: 4.3, baseLoad: 1.2, distance: 510 },
  { id: 'M-09', name: 'Dev House', role: 'prosumer', pv: 3.1, baseLoad: 2.5, distance: 580 },
  { id: 'M-10', name: 'Saanvi Home', role: 'consumer', pv: 0.0, baseLoad: 2.9, distance: 640 },
  { id: 'M-11', name: 'Arjun Solar', role: 'solar', pv: 3.7, baseLoad: 1.4, distance: 700 },
  { id: 'M-12', name: 'Zoya Home', role: 'consumer', pv: 0.0, baseLoad: 2.2, distance: 760 },
];

class SimulationEngine {
  private intervalId: NodeJS.Timeout | null = null;
  private unauthenticatedSockets: Map<WebSocket, NodeJS.Timeout> = new Map();
  private authenticatedSockets: Map<WebSocket, { role: string; meterId: string | null }> = new Map();

  public registerClient(ws: WebSocket) {
    // 10-second authentication window
    const timeoutId = setTimeout(() => {
      if (this.unauthenticatedSockets.has(ws)) {
        this.unauthenticatedSockets.delete(ws);
        ws.close(4001, 'Authentication timeout');
      }
    }, 10000);
    this.unauthenticatedSockets.set(ws, timeoutId);

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'auth' && message.token) {
          const session = await resolveSession(message.token);
          if (session) {
            // Cancel the timeout
            const tId = this.unauthenticatedSockets.get(ws);
            if (tId) clearTimeout(tId);
            this.unauthenticatedSockets.delete(ws);

            // Register as authenticated
            this.authenticatedSockets.set(ws, { role: session.role, meterId: session.meterId });

            // Send current scoped state to newly authenticated client
            await this.sendCurrentStateToClient(ws);
            return;
          }
        }
      } catch (err) {
        console.error('WebSocket client auth parsing error:', err);
      }

      // If we reach here, authentication failed or message was invalid
      const tId = this.unauthenticatedSockets.get(ws);
      if (tId) clearTimeout(tId);
      this.unauthenticatedSockets.delete(ws);
      ws.close(4003, 'Invalid authentication token');
    });

    ws.on('close', () => {
      const tId = this.unauthenticatedSockets.get(ws);
      if (tId) clearTimeout(tId);
      this.unauthenticatedSockets.delete(ws);
      this.authenticatedSockets.delete(ws);
    });
  }



  public async start() {
    try {
      let state = await prisma.simulationState.findUnique({ where: { id: 1 } });
      if (!state) {
        state = await prisma.simulationState.create({
          data: {
            id: 1,
            tick: 62,
            playing: true,
            speed: '1x',
            cumulativeBaseline: 0.0,
          },
        });
      }

      const meterCount = await prisma.meter.count();
      if (meterCount === 0) {
        for (const item of defaultSeedMeters) {
          const num = parseInt(item.id.replace('M-', ''), 10);
          const pin = (1000 + num).toString();
          await prisma.meter.upsert({
            where: { id: item.id },
            update: {},
            create: {
              id: item.id,
              name: item.name,
              role: item.role,
              pv: item.pv,
              baseLoad: item.baseLoad,
              distance: item.distance,
              earned: 0.0,
              sharedPartners: '',
              pin: pin,
              displayName: null,
            },
          });
        }
      }

      if (state && state.playing) {
        this.startTimer(state.speed);
      }
    } catch (err) {
      console.error('Error starting simulation engine:', err);
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

  private isProcessing = false;

  private async tick() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    try {
      let state = await prisma.simulationState.findUnique({ where: { id: 1 } });
      if (!state) return;

      const nextTick = (state.tick + 1) % 96;
      await prisma.simulationState.update({
        where: { id: 1 },
        data: { tick: nextTick },
      });

      await this.runSimulationStep(nextTick);
    } catch (err) {
      console.error('Error during tick processing:', err);
    } finally {
      this.isProcessing = false;
    }
  }

  private async runSimulationStep(tick: number) {
    try {
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
        tickBaseline += t.kwh * PFIT;

        const seller = simulatedMeters.find((m) => m.name === t.seller || m.id === t.seller);
        const buyer = simulatedMeters.find((m) => m.name === t.buyer || m.id === t.buyer);

        if (seller) {
          const gain = t.sent * (t.energyPrice - PFIT);
          if (!meterEarningsUpdate[seller.id]) {
            meterEarningsUpdate[seller.id] = { earned: 0, partner: '' };
          }
          meterEarningsUpdate[seller.id].earned += gain;
          if (buyer) {
            meterEarningsUpdate[seller.id].partner = buyer.id;
          }
        }

        if (buyer) {
          const saving = t.delivered * (PGRID - t.buyerUnitPrice);
          if (!meterEarningsUpdate[buyer.id]) {
            meterEarningsUpdate[buyer.id] = { earned: 0, partner: '' };
          }
          meterEarningsUpdate[buyer.id].earned += saving;
          if (seller) {
            meterEarningsUpdate[buyer.id].partner = seller.id;
          }
        }
      });

      // 5. Update cumulative baseline
      await prisma.simulationState.update({
        where: { id: 1 },
        data: {
          cumulativeBaseline: {
            increment: tickBaseline,
          },
        },
      });

      // 6. Update individual meters
      for (const meterId of Object.keys(meterEarningsUpdate)) {
        const update = meterEarningsUpdate[meterId];
        const m = dbMeters.find((x) => x.id === meterId);
        if (m) {
          const currentPartners = m.sharedPartners ? m.sharedPartners.split(',') : [];
          if (update.partner && !currentPartners.includes(update.partner)) {
            currentPartners.push(update.partner);
          }
          await prisma.meter.update({
            where: { id: meterId },
            data: {
              earned: { increment: update.earned },
              sharedPartners: currentPartners.join(','),
            },
          });
        }
      }

      // 7. Batch insert meter readings (1 fast query)
      if (simulatedMeters.length > 0) {
        await prisma.meterReading.createMany({
          data: simulatedMeters.map((m) => ({
            tick,
            meterId: m.id,
            generation: m.generation,
            load: m.load,
            exportKWh: m.exportKWh,
            importKWh: m.importKWh,
            voltage: m.voltage,
            current: m.current,
            powerFactor: m.powerFactor,
          })),
        });
      }

      // 8. Batch insert trades (1 fast query)
      if (trades.length > 0) {
        await prisma.trade.createMany({
          data: trades.map((t) => ({
            id: `${t.id}-${tick}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
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
          })),
        });
      }

      // 9. Broadcast updated state to all connected WebSocket clients
      await this.broadcastState();
    } catch (error) {
      console.error('Error running simulation step:', error);
    }
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
    for (const [ws, session] of this.authenticatedSockets.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        const scoped = scopeStatePayload(payload, session);
        ws.send(JSON.stringify(scoped));
      }
    }
  }

  private async sendCurrentStateToClient(ws: WebSocket) {
    const session = this.authenticatedSockets.get(ws);
    if (session && ws.readyState === WebSocket.OPEN) {
      const payload = await this.getCurrentStatePayload();
      const scoped = scopeStatePayload(payload, session);
      ws.send(JSON.stringify(scoped));
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
