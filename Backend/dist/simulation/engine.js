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
const session_1 = require("../auth/session");
const scope_1 = require("./scope");
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
    intervalId = null;
    unauthenticatedSockets = new Map();
    authenticatedSockets = new Map();
    registerClient(ws) {
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
                    const session = await (0, session_1.resolveSession)(message.token);
                    if (session) {
                        // Cancel the timeout
                        const tId = this.unauthenticatedSockets.get(ws);
                        if (tId)
                            clearTimeout(tId);
                        this.unauthenticatedSockets.delete(ws);
                        // Register as authenticated
                        this.authenticatedSockets.set(ws, { role: session.role, meterId: session.meterId });
                        // Send current scoped state to newly authenticated client
                        await this.sendCurrentStateToClient(ws);
                        return;
                    }
                }
            }
            catch (err) {
                console.error('WebSocket client auth parsing error:', err);
            }
            // If we reach here, authentication failed or message was invalid
            const tId = this.unauthenticatedSockets.get(ws);
            if (tId)
                clearTimeout(tId);
            this.unauthenticatedSockets.delete(ws);
            ws.close(4003, 'Invalid authentication token');
        });
        ws.on('close', () => {
            const tId = this.unauthenticatedSockets.get(ws);
            if (tId)
                clearTimeout(tId);
            this.unauthenticatedSockets.delete(ws);
            this.authenticatedSockets.delete(ws);
        });
    }
    async start() {
        try {
            let state = await prismaClient_1.default.simulationState.findUnique({ where: { id: 1 } });
            if (!state) {
                state = await prismaClient_1.default.simulationState.create({
                    data: {
                        id: 1,
                        tick: 62,
                        playing: true,
                        speed: '1x',
                        cumulativeBaseline: 0.0,
                    },
                });
            }
            const meterCount = await prismaClient_1.default.meter.count();
            if (meterCount === 0) {
                for (const item of defaultSeedMeters) {
                    const num = parseInt(item.id.replace('M-', ''), 10);
                    const pin = (1000 + num).toString();
                    await prismaClient_1.default.meter.upsert({
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
        }
        catch (err) {
            console.error('Error starting simulation engine:', err);
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
    isProcessing = false;
    async tick() {
        if (this.isProcessing)
            return;
        this.isProcessing = true;
        try {
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
        catch (err) {
            console.error('Error during tick processing:', err);
        }
        finally {
            this.isProcessing = false;
        }
    }
    async runSimulationStep(tick) {
        try {
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
            // 5. Update cumulative baseline
            await prismaClient_1.default.simulationState.update({
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
                    await prismaClient_1.default.meter.update({
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
                await prismaClient_1.default.meterReading.createMany({
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
                await prismaClient_1.default.trade.createMany({
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
        }
        catch (error) {
            console.error('Error running simulation step:', error);
        }
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
        for (const [ws, session] of this.authenticatedSockets.entries()) {
            if (ws.readyState === ws_1.WebSocket.OPEN) {
                const scoped = (0, scope_1.scopeStatePayload)(payload, session);
                ws.send(JSON.stringify(scoped));
            }
        }
    }
    async sendCurrentStateToClient(ws) {
        const session = this.authenticatedSockets.get(ws);
        if (session && ws.readyState === ws_1.WebSocket.OPEN) {
            const payload = await this.getCurrentStatePayload();
            const scoped = (0, scope_1.scopeStatePayload)(payload, session);
            ws.send(JSON.stringify(scoped));
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
