import express from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import { signToken } from '../middleware/auth.js';

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: { message: 'Too many attempts, please try again later.' },
});

// POST /api/auth/register
router.post(
  '/register',
  authLimiter,
  [
    body('userName').trim().notEmpty().withMessage('Username is required'),
    body('password').isLength({ min: 4 }).withMessage('Password must be at least 4 characters'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
      }

      const { userName, password } = req.body;

      const existing = await User.findOne({ userName });
      if (existing) {
        return res.status(409).json({ message: 'Username already taken' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await User.create({ userName, passwordHash });

      const token = signToken({ id: user._id, userName: user.userName });
      return res.status(201).json({
        token,
        user: { id: user._id, userName: user.userName },
      });
    } catch (err) {
      console.error('Register error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  authLimiter,
  [
    body('userName').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
      }

      const { userName, password } = req.body;

      const user = await User.findOne({ userName });
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = signToken({ id: user._id, userName: user.userName });
      return res.json({
        token,
        user: { id: user._id, userName: user.userName },
      });
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

export default router;
