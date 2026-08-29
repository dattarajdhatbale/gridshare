import { Router, Request, Response } from 'express';
import { engine } from '../simulation/engine';
import prisma from '../db/prismaClient';
import { simulateMetersForTick } from '../simulation/simulator';
import { requireAuth, requireOperator } from '../auth/middleware';
import { scopeStatePayload } from '../simulation/scope';

const router = Router();

// 1. Get current simulation parameters (meters, trades, tick, baseline, cumulative benefit maps)
router.get('/state', requireAuth, async (req: Request, res: Response) => {
  try {
    const payload = await engine.getCurrentStatePayload();
    const scopedPayload = scopeStatePayload(payload, req.session!);
    res.json(scopedPayload);
  } catch (error) {
    console.error('Error fetching state:', error);
    res.status(500).json({ error: 'Failed to retrieve simulation state.' });
  }
});

// 2. Play/Pause or update simulation speed
router.post('/control', requireAuth, requireOperator, async (req: Request, res: Response) => {
  try {
    const { playing, speed } = req.body;
    await engine.setControl(playing, speed);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating controls:', error);
    res.status(500).json({ error: 'Failed to update simulation controls.' });
  }
});

// 3. Jump to a specific tick manually (e.g. simulate cloud cover at tick 30)
router.post('/tick', requireAuth, requireOperator, async (req: Request, res: Response) => {
  try {
    const { tick } = req.body;
    if (tick === undefined || typeof tick !== 'number' || tick < 0 || tick >= 96) {
      return res.status(400).json({ error: 'Invalid tick value. Must be between 0 and 95.' });
    }
    await engine.forceTick(tick);
    res.json({ success: true });
  } catch (error) {
    console.error('Error forcing tick:', error);
    res.status(500).json({ error: 'Failed to force simulation tick.' });
  }
});

// 4. Reset simulation states, clear databases logs, and restart from tick 62
router.post('/reset', requireAuth, requireOperator, async (req: Request, res: Response) => {
  try {
    await engine.reset();
    res.json({ success: true });
  } catch (error) {
    console.error('Error resetting simulation:', error);
    res.status(500).json({ error: 'Failed to reset simulation.' });
  }
});

// 5. Fetch sliding history array of last 15 intervals to feed frontend demand-supply curves
router.get('/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const state = await prisma.simulationState.findUnique({ where: { id: 1 } });
    const dbMeters = await prisma.meter.findMany();
    const tick = state ? state.tick : 62;

    const history = [];
    for (let i = 14; i >= 0; i--) {
      const t = (tick - i + 96) % 96;
      const tickMeters = simulateMetersForTick(t, dbMeters);
      const supply = tickMeters.reduce((sum, m) => sum + m.generation, 0);
      const demand = tickMeters.reduce((sum, m) => sum + m.load, 0);
      history.push({ tick: t, supply, demand });
    }

    res.json(history);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to retrieve simulation history.' });
  }
});

// 6. GET /history/trades - fetch list of transactions (trades) for current user (or all if operator)
router.get('/history/trades', requireAuth, async (req: Request, res: Response) => {
  try {
    const limitQuery = req.query.limit;
    let limit = 500;
    if (limitQuery !== undefined) {
      if (limitQuery === 'none' || limitQuery === 'all') {
        limit = 1000000;
      } else {
        const parsedLimit = parseInt(limitQuery as string, 10);
        if (!isNaN(parsedLimit) && parsedLimit > 0) {
          limit = parsedLimit;
        }
      }
    }

    const { role, meterId } = req.session!;

    const trades = await prisma.trade.findMany({
      where: role === 'household' ? {
        OR: [
          { buyer: meterId! },
          { seller: meterId! },
        ],
      } : undefined,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    res.json(trades);
  } catch (error) {
    console.error('Error fetching trades history:', error);
    res.status(500).json({ error: 'Failed to retrieve trade history.' });
  }
});

export default router;
