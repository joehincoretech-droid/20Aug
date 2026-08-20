import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { writeAudit } from '../utils/audit.js';
import { authRequired } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }
  const user = await User.findOne({ username: String(username).trim() });
  if (!user) {
    return res.status(401).json({ message: 'Invalid username or password' });
  }
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return res.status(401).json({ message: 'Invalid username or password' });
  }
  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
  await writeAudit(user._id, 'LOGIN', { username: user.username });
  res.json({
    token,
    user: { id: user._id, username: user.username, role: user.role },
  });
});

authRouter.get('/me', authRequired, (req, res) => {
  res.json({
    user: { id: req.user._id, username: req.user.username, role: req.user.role },
  });
});
