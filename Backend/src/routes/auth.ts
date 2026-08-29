import { Router, Request, Response } from 'express';
import prisma from '../db/prismaClient';
import { createSession, destroySession } from '../auth/session';
import { requireAuth } from '../auth/middleware';

const router = Router();

const OPERATOR_CODE = process.env.OPERATOR_CODE || 'grid-admin';

// Naive in-memory rate limiting for login routes: 8 attempts per IP per minute
interface RateLimitInfo {
  attempts: number;
  resetTime: number;
}
const rateLimits = new Map<string, RateLimitInfo>();

function rateLimiter(req: Request, res: Response, next: () => void) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const limit = rateLimits.get(ip);

  if (limit) {
    if (now > limit.resetTime) {
      rateLimits.set(ip, { attempts: 1, resetTime: now + 60000 });
      return next();
    } else {
      limit.attempts++;
      if (limit.attempts > 8) {
        return res.status(429).json({ error: 'Too many login attempts. Please try again in a minute.' });
      }
    }
  } else {
    rateLimits.set(ip, { attempts: 1, resetTime: now + 60000 });
  }
  next();
}

// 1. GET /meters (unauthenticated) - return id, name, role for household selection grid
router.get('/meters', async (req: Request, res: Response) => {
  try {
    const meters = await prisma.meter.findMany({
      select: {
        id: true,
        name: true,
        role: true,
      },
      orderBy: {
        id: 'asc',
      },
    });
    res.json(meters);
  } catch (error) {
    console.error('Error fetching meters list:', error);
    res.status(500).json({ error: 'Failed to fetch meters list.' });
  }
});

// 2. POST /login/household - body { meterId, pin }
router.post('/login/household', rateLimiter, async (req: Request, res: Response) => {
  try {
    const { meterId, pin } = req.body;
    if (!meterId || !pin) {
      return res.status(400).json({ error: 'Meter ID and PIN are required.' });
    }

    const meter = await prisma.meter.findUnique({
      where: { id: meterId },
    });

    if (!meter || meter.pin !== pin) {
      // Generic error message to never reveal whether meter ID or PIN was wrong
      return res.status(401).json({ error: 'Invalid Credentials.' });
    }

    const token = await createSession('household', meter.id);

    res.json({
      token,
      role: 'household',
      meter: {
        id: meter.id,
        name: meter.name,
        displayName: meter.displayName,
        role: meter.role,
        pv: meter.pv,
        baseLoad: meter.baseLoad,
        distance: meter.distance,
      },
    });
  } catch (error) {
    console.error('Household login error:', error);
    res.status(500).json({ error: 'Internal login server error.' });
  }
});

// 3. POST /login/operator - body { code }
router.post('/login/operator', rateLimiter, async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Operator code is required.' });
    }

    if (code !== OPERATOR_CODE) {
      return res.status(401).json({ error: 'Invalid Credentials.' });
    }

    const token = await createSession('operator', null);

    res.json({
      token,
      role: 'operator',
    });
  } catch (error) {
    console.error('Operator login error:', error);
    res.status(500).json({ error: 'Internal login server error.' });
  }
});

// 4. POST /logout - destroy current session
router.post('/logout', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    await destroySession(token);
  }
  res.json({ success: true });
});

// 5. GET /me - returns current session profile
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = req.session!;
    if (session.role === 'operator') {
      return res.json({ role: 'operator' });
    }

    // For households, fetch and return the fresh meter details
    const meter = await prisma.meter.findUnique({
      where: { id: session.meterId! },
    });

    if (!meter) {
      return res.status(404).json({ error: 'Associated meter not found.' });
    }

    res.json({
      role: 'household',
      meter: {
        id: meter.id,
        name: meter.name,
        displayName: meter.displayName,
        role: meter.role,
        pv: meter.pv,
        baseLoad: meter.baseLoad,
        distance: meter.distance,
      },
    });
  } catch (error) {
    console.error('Error fetching current session info:', error);
    res.status(500).json({ error: 'Failed to retrieve session profile.' });
  }
});

// 6. PATCH /me/profile - update household displayName
router.patch('/me/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = req.session!;
    if (session.role !== 'household') {
      return res.status(403).json({ error: 'Only households can update their display profile name.' });
    }

    const { displayName } = req.body;
    if (displayName === undefined) {
      return res.status(400).json({ error: 'displayName property is required.' });
    }

    const updatedMeter = await prisma.meter.update({
      where: { id: session.meterId! },
      data: {
        displayName: displayName ? displayName.trim() : null,
      },
    });

    res.json({
      id: updatedMeter.id,
      name: updatedMeter.name,
      displayName: updatedMeter.displayName,
      role: updatedMeter.role,
      pv: updatedMeter.pv,
      baseLoad: updatedMeter.baseLoad,
      distance: updatedMeter.distance,
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

export default router;
