import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { writeAudit } from '../utils/audit.js';
import { authRequired, requireRole } from '../middleware/auth.js';

export const usersRouter = Router();

usersRouter.use(authRequired, requireRole('admin'));

usersRouter.get('/', async (_req, res) => {
  const users = await User.find().select('-password').sort({ createdAt: -1 });
  res.json({ users });
});

usersRouter.post('/', async (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }
  const nextRole = ['admin', 'worker', 'po'].includes(role) ? role : 'worker';
  const exists = await User.findOne({ username: String(username).trim() });
  if (exists) {
    return res.status(409).json({ message: 'Username already exists' });
  }
  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({
    username: String(username).trim(),
    password: hash,
    role: nextRole,
  });
  await writeAudit(req.user._id, 'USER_CREATE', {
    createdUserId: user._id,
    username: user.username,
    role: user.role,
  });
  res.status(201).json({
    user: { id: user._id, username: user.username, role: user.role },
  });
});
