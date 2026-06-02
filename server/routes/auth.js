const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Settings } = require('../models');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const secret = process.env.JWT_SECRET || 'super-secret-chills-key';

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
    });

    // Initialize their settings
    await Settings.getForUser(user._id);

    const token = jwt.sign({ userId: user._id }, secret, { expiresIn: '7d' });
    return res.status(201).json({ token, user: { id: user._id, email: user.email, tier: user.tier, hasSeenGlobalTour: user.hasSeenGlobalTour } });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 * Login existing user
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id }, secret, { expiresIn: '7d' });
    return res.status(200).json({ token, user: { id: user._id, email: user.email, tier: user.tier, hasSeenGlobalTour: user.hasSeenGlobalTour } });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authMiddleware, (req, res) => {
  res.json({ id: req.user._id, email: req.user.email, tier: req.user.tier, hasSeenGlobalTour: req.user.hasSeenGlobalTour });
});

/**
 * POST /api/auth/tour-seen
 * Mark global tour as seen
 */
router.post('/tour-seen', authMiddleware, async (req, res) => {
  try {
    req.user.hasSeenGlobalTour = true;
    await req.user.save();
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating tour status:', err);
    res.status(500).json({ error: 'Failed to update tour status' });
  }
});

module.exports = router;
