import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { User, type UserRole } from '../models/User.js';
import { writeAudit } from '../utils/audit.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import {
  isPasswordExpired,
  passwordAgeDays,
  PASSWORD_MAX_AGE_DAYS,
  validatePassword,
} from '../utils/password.js';

export const usersRouter = Router();

usersRouter.use(authRequired, requireRole('admin'));

function userPayload(user: {
  _id: unknown;
  username: string;
  role: string;
  createdAt?: Date;
  passwordChangedAt?: Date;
}) {
  const passwordChangedAt = user.passwordChangedAt ?? user.createdAt;
  const passwordDaysUsed = passwordAgeDays(passwordChangedAt, user.createdAt);
  return {
    _id: user._id,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt,
    passwordChangedAt,
    passwordDaysUsed,
    passwordExpired: isPasswordExpired(passwordChangedAt, user.createdAt),
    passwordMaxAgeDays: PASSWORD_MAX_AGE_DAYS,
  };
}

usersRouter.get('/', async (_req: Request, res: Response) => {
  const users = await User.find().select('-password').sort({ createdAt: -1 });
  res.json({ users: users.map(userPayload) });
});

usersRouter.post('/', async (req: Request, res: Response) => {
  const { username, password, role } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }
  const passwordError = validatePassword(String(password));
  if (passwordError) {
    return res.status(400).json({ message: passwordError, code: 'INVALID_PASSWORD' });
  }
  const nextRole: UserRole = (['admin', 'worker', 'po'] as UserRole[]).includes(role)
    ? role
    : 'worker';
  const exists = await User.findOne({ username: String(username).trim() });
  if (exists) {
    return res.status(409).json({ message: 'Username already exists' });
  }
  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({
    username: String(username).trim(),
    password: hash,
    role: nextRole,
    passwordChangedAt: new Date(),
  });
  await writeAudit(req.user!._id, 'USER_CREATE', {
    createdUserId: user._id,
    username: user.username,
    role: user.role,
  });
  res.status(201).json({ user: userPayload(user) });
});

usersRouter.patch('/:id', async (req: Request, res: Response) => {
  const { username, password, role } = req.body || {};
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const updates: { username?: string; role?: UserRole; password?: string; passwordChangedAt?: Date } = {};

  if (username !== undefined) {
    const trimmed = String(username).trim();
    if (!trimmed) {
      return res.status(400).json({ message: 'Username is required' });
    }
    if (trimmed !== user.username) {
      const exists = await User.findOne({ username: trimmed, _id: { $ne: user._id } });
      if (exists) {
        return res.status(409).json({ message: 'Username already exists' });
      }
      updates.username = trimmed;
    }
  }

  if (role !== undefined) {
    updates.role = (['admin', 'worker', 'po'] as UserRole[]).includes(role) ? role : user.role;
  }

  if (password !== undefined && String(password).length > 0) {
    const passwordError = validatePassword(String(password));
    if (passwordError) {
      return res.status(400).json({ message: passwordError, code: 'INVALID_PASSWORD' });
    }
    updates.password = await bcrypt.hash(String(password), 10);
    updates.passwordChangedAt = new Date();
  }

  if (!updates.username && !updates.role && !updates.password) {
    return res.status(400).json({ message: 'No changes provided' });
  }

  Object.assign(user, updates);
  await user.save();

  await writeAudit(req.user!._id, 'USER_UPDATE', {
    updatedUserId: user._id,
    username: user.username,
    role: user.role,
    passwordChanged: Boolean(updates.password),
  });

  res.json({ user: userPayload(user) });
});
