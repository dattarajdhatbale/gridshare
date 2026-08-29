import { Request, Response, NextFunction } from 'express';
import { resolveSession } from './session';

/**
 * Middleware that authenticates a request using Bearer Token.
 * Attaches req.session if valid, otherwise returns 401.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication token required.' });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  try {
    const session = await resolveSession(token);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired authentication session.' });
    }

    req.session = {
      role: session.role,
      meterId: session.meterId,
    };
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({ error: 'Internal authentication server error.' });
  }
}

/**
 * Middleware that enforces the role to be 'operator'.
 * Returns 403 if request is not by an operator.
 */
export function requireOperator(req: Request, res: Response, next: NextFunction) {
  if (!req.session || req.session.role !== 'operator') {
    return res.status(403).json({ error: 'Only the grid operator can control the simulation.' });
  }
  next();
}
