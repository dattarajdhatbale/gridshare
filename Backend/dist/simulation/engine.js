"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.engine = void 0;
const prismaClient_1 = __importDefault(require("../db/prismaClient"));
const simulator_1 = require("./simulator");
const matching_1 = require("./matching");
const model_1 = require("./model");
const ws_1 = require("ws");
class SimulationEngine {
    intervalId = null;
    wsClients = new Set();
    registerClient(ws) {
        this.wsClients.add(ws);
        ws.on('close', () => this.wsClients.delete(ws));
        // Send current state to newly connected client
        this.sendCurrentStateToClient(ws);
    }
    broadcast(data) {
        const payload = JSON.stringify(data);
        for (const client of this.wsClients) {
            if (client.readyState === ws_1.WebSocket.OPEN) {
                client.send(payload);
            }
        }
    }
    async start() {
        const state = await prismaClient_1.default.simulationState.findUnique({ where: { id: 1 } });
        if (!state)
            return;
        if (state.playing) {
            this.startTimer(state.speed);
        }
    }
    startTimer(speed) {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        const ms = speed === '4x' ? 250 : speed === '2x' ? 500 : 1000;
        this.intervalId = setInterval(() => this.tick(), ms);
    }
    stopTimer() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
    async setControl(playing, speed) {
        let state = await prismaClient_1.default.simulationState.findUnique({ where: { id: 1 } });
        if (!state)
            return;
        const nextPlaying = playing !== undefined ? playing : state.playing;
        const nextSpeed = speed !== undefined ? speed : state.speed;
        state = await prismaClient_1.default.simulationState.update({
            where: { id: 1 },
            data: {
                playing: nextPlaying,
                speed: nextSpeed,
            },
        });
        if (nextPlaying) {
            this.startTimer(nextSpeed);
        }
        else {
            this.stopTimer();
        }
        // Broadcast state update
        await this.broadcastState();
    }
    async forceTick(targetTick) {
        let state = await prismaClient_1.default.simulationState.findUnique({ where: { id: 1 } });
        if (!state)
            return;
        state = await prismaClient_1.default.simulationState.update({
            where: { id: 1 },
            data: { tick: targetTick },
        });
        // Run a simulation step for this tick (saves reading, matching, ledger updates)
        await this.runSimulationStep(targetTick);
    }
    async tick() {
        let state = await prismaClient_1.default.simulationState.findUnique({ where: { id: 1 } });
        if (!state)
            return;
        const nextTick = (state.tick + 1) % 96;
        await prismaClient_1.default.simulationState.update({
            where: { id: 1 },
            data: { tick: nextTick },
        });
        await this.runSimulationStep(nextTick);
    }
    async runSimulationStep(tick) {
        // 1. Fetch current database states
        const dbMeters = await prismaClient_1.default.meter.findMany();
        const state = await prismaClient_1.default.simulationState.findUnique({ where: { id: 1 } });
        if (!state)
            return;
        // 2. Compute physics (generation and load)
        const simulatedMeters = (0, simulator_1.simulateMetersForTick)(tick, dbMeters);
        // 3. Resolve market trading clearing
        const trades = (0, matching_1.optimizeTrades)(simulatedMeters);
        // 4. Update the DB: accumulate savings, ledger, counterparties, and baseline utility
        let tickBaseline = 0;
        const meterEarningsUpdate = {};
        trades.forEach((t) => {
            tickBaseline += t.kwh * model_1.PFIT;
            const seller = simulatedMeters.find((m) => m.name === t.seller || m.id === t.seller);
            const buyer = simulatedMeters.find((m) => m.name === t.buyer || m.id === t.buyer);
            if (seller) {
                const gain = t.sent * (t.energyPrice - model_1.PFIT);
                if (!meterEarningsUpdate[seller.id]) {
                    meterEarningsUpdate[seller.id] = { earned: 0, partner: '' };
                }
                meterEarningsUpdate[seller.id].earned += gain;
                if (buyer) {
                    meterEarningsUpdate[seller.id].partner = buyer.id;
                }
            }
            if (buyer) {
                const saving = t.delivered * (model_1.PGRID - t.buyerUnitPrice);
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
        await prismaClient_1.default.$transaction(async (tx) => {
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
    async reset() {
        this.stopTimer();
        // 1. Reset simulation configs
        await prismaClient_1.default.simulationState.update({
            where: { id: 1 },
            data: {
                tick: 62,
                playing: true,
                speed: '1x',
                cumulativeBaseline: 0.0,
            },
        });
        // 2. Reset meter parameters
        await prismaClient_1.default.meter.updateMany({
            data: {
                earned: 0.0,
                sharedPartners: '',
            },
        });
        // 3. Delete logs
        await prismaClient_1.default.meterReading.deleteMany({});
        await prismaClient_1.default.trade.deleteMany({});
        this.startTimer('1x');
        await this.broadcastState();
    }
    async broadcastState() {
        const payload = await this.getCurrentStatePayload();
        this.broadcast(payload);
    }
    async sendCurrentStateToClient(ws) {
        const payload = await this.getCurrentStatePayload();
        if (ws.readyState === ws_1.WebSocket.OPEN) {
            ws.send(JSON.stringify(payload));
        }
    }
    async getCurrentStatePayload() {
        const state = await prismaClient_1.default.simulationState.findUnique({ where: { id: 1 } });
        const dbMeters = await prismaClient_1.default.meter.findMany();
        if (!state)
            return {};
        // Get current tick parameters
        const simulatedMeters = (0, simulator_1.simulateMetersForTick)(state.tick, dbMeters);
        const trades = (0, matching_1.optimizeTrades)(simulatedMeters);
        // Build ledger maps
        const ledger = {};
        const sharedPartners = {};
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
exports.engine = new SimulationEngine();
