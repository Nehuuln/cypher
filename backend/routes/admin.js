const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

// GET /api/admin/dashboard
router.get('/dashboard', authMiddleware, authMiddleware.adminOnly, (req, res) => {
  return res.json({ message: 'Admin dashboard' });
});

// GET /api/admin/users - liste des utilisateurs (sans password)
router.get('/users', authMiddleware, authMiddleware.adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    return res.json({ users });
  } catch (err) {
    console.error('GET /api/admin/users error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;