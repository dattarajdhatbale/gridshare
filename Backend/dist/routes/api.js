"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const engine_1 = require("../simulation/engine");
const prismaClient_1 = __importDefault(require("../db/prismaClient"));
const simulator_1 = require("../simulation/simulator");
const middleware_1 = require("../auth/middleware");
const scope_1 = require("../simulation/scope");
const router = (0, express_1.Router)();
// 0. Diagnostics Version Endpoint (unauthenticated)
router.get('/version', (req, res) => {
    res.json({
        status: 'ok',
        version: '1.0.1',
        buildTime: new Date().toISOString(),
        info: 'GridShare Backend active diagnostics'
    });
});
// 1. Get current simulation parameters (meters, trades, tick, baseline, cumulative benefit maps)
router.get('/state', middleware_1.requireAuth, async (req, res) => {
    try {
        const payload = await engine_1.engine.getCurrentStatePayload();
        const scopedPayload = (0, scope_1.scopeStatePayload)(payload, req.session);
        res.json(scopedPayload);
    }
    catch (error) {
        console.error('Error fetching state:', error);
        res.status(500).json({ error: 'Failed to retrieve simulation state.' });
    }
});
// 2. Play/Pause or update simulation speed
router.post('/control', middleware_1.requireAuth, middleware_1.requireOperator, async (req, res) => {
    try {
        const { playing, speed } = req.body;
        await engine_1.engine.setControl(playing, speed);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error updating controls:', error);
        res.status(500).json({ error: 'Failed to update simulation controls.' });
    }
});
// 3. Jump to a specific tick manually (e.g. simulate cloud cover at tick 30)
router.post('/tick', middleware_1.requireAuth, middleware_1.requireOperator, async (req, res) => {
    try {
        const { tick } = req.body;
        if (tick === undefined || typeof tick !== 'number' || tick < 0 || tick >= 96) {
            return res.status(400).json({ error: 'Invalid tick value. Must be between 0 and 95.' });
        }
        await engine_1.engine.forceTick(tick);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error forcing tick:', error);
        res.status(500).json({ error: 'Failed to force simulation tick.' });
    }
});
// 4. Reset simulation states, clear databases logs, and restart from tick 62
router.post('/reset', middleware_1.requireAuth, middleware_1.requireOperator, async (req, res) => {
    try {
        await engine_1.engine.reset();
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error resetting simulation:', error);
        res.status(500).json({ error: 'Failed to reset simulation.' });
    }
});
// 5. Fetch sliding history array of last 15 intervals to feed frontend demand-supply curves
router.get('/history', middleware_1.requireAuth, async (req, res) => {
    try {
        const state = await prismaClient_1.default.simulationState.findUnique({ where: { id: 1 } });
        const dbMeters = await prismaClient_1.default.meter.findMany();
        const tick = state ? state.tick : 62;
        const history = [];
        for (let i = 14; i >= 0; i--) {
            const t = (tick - i + 96) % 96;
            const tickMeters = (0, simulator_1.simulateMetersForTick)(t, dbMeters);
            const supply = tickMeters.reduce((sum, m) => sum + m.generation, 0);
            const demand = tickMeters.reduce((sum, m) => sum + m.load, 0);
            history.push({ tick: t, supply, demand });
        }
        res.json(history);
    }
    catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: 'Failed to retrieve simulation history.' });
    }
});
// 6. GET /history/trades - fetch list of transactions (trades) for current user (or all if operator)
router.get('/history/trades', middleware_1.requireAuth, async (req, res) => {
    try {
        const limitQuery = req.query.limit;
        let limit = 500;
        if (limitQuery !== undefined) {
            if (limitQuery === 'none' || limitQuery === 'all') {
                limit = 1000000;
            }
            else {
                const parsedLimit = parseInt(limitQuery, 10);
                if (!isNaN(parsedLimit) && parsedLimit > 0) {
                    limit = parsedLimit;
                }
            }
        }
        const { role, meterId } = req.session;
        const trades = await prismaClient_1.default.trade.findMany({
            where: role === 'household' ? {
                OR: [
                    { buyer: meterId },
                    { seller: meterId },
                ],
            } : undefined,
            orderBy: {
                createdAt: 'desc',
            },
            take: limit,
        });
        res.json(trades);
    }
    catch (error) {
        console.error('Error fetching trades history:', error);
        res.status(500).json({ error: 'Failed to retrieve trade history.' });
    }
});
exports.default = router;
