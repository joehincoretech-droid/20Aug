import type { HydratedDocument } from 'mongoose';
import type { IUser } from '../models/User.js';

export type AuthUser = Omit<HydratedDocument<IUser>, 'password'>;

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
