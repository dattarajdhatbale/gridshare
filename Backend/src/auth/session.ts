import crypto from 'crypto';
import prisma from '../db/prismaClient';

export interface SessionData {
  token: string;
  role: string;
  meterId: string | null;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Creates a new session in the database for the given role and optional meterId.
 * Returns the generated 12-hour opaque token.
 */
export async function createSession(role: string, meterId?: string | null): Promise<string> {
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours from now

  await prisma.session.create({
    data: {
      token,
      role,
      meterId: meterId || null,
      expiresAt,
    },
  });

  return token;
}

/**
 * Resolves a session from the token, sweeping expired session rows first.
 * Returns the session if valid, otherwise null.
 */
export async function resolveSession(token: string): Promise<SessionData | null> {
  const now = new Date();

  // Passive sweeping of expired sessions to keep the session table clean
  try {
    await prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    });
  } catch (error) {
    console.error('Error sweeping expired sessions:', error);
  }

  const session = await prisma.session.findUnique({
    where: { token },
  });

  if (!session) return null;

  // Double check expiry (should be handled by deleteMany, but safe fallback)
  if (session.expiresAt < now) {
    await destroySession(token);
    return null;
  }

  return session;
}

/**
 * Deletes a session token from the database.
 */
export async function destroySession(token: string): Promise<void> {
  try {
    await prisma.session.delete({
      where: { token },
    });
  } catch (error) {
    // If already deleted/expired, fail silently
  }
}
