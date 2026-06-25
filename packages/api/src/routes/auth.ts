// packages/api/src/routes/auth.ts
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { UserRepository } from '../repositories/UserRepository.js';
import { getDB } from '../config/db.js';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../errors/index.js';

const router = Router();

// Limit login attempts — prevents brute-force attacks on credentials
const loginLimiter = rateLimit({
  windowMs:        60 * 1000,  // 1 minute window
  max:             10,          // 10 attempts per window per IP
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Too many login attempts — try again in a minute' },
  skip: req => req.method === 'OPTIONS',
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(422).json({ error: 'Email and password required' });
      return;
    }

    const db   = getDB();
    const user = await UserRepository.findByEmail(db, email);

    if (!user || !user.active || !user.passwordHash) throw new UnauthorizedError('Invalid credentials');

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) throw new UnauthorizedError('Invalid credentials');

    await UserRepository.touch(db, user._id);

    const payload = {
      id:       user._id,
      name:     user.name,
      email:    user.email,
      role:     user.role,
      entity:   user.entity,
      location: user.location,
      tenantId: user.tenantId,
    };

    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, expiresIn: '7d', user: payload });
  } catch (err) {
    next(err);
  }
});

export default router;
