import { SessionData } from '../auth/session';

declare global {
  namespace Express {
    interface Request {
      session?: {
        role: string;
        meterId: string | null;
      };
    }
  }
}
