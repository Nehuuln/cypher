const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

// GET /api/users/:id  (protected, prevents IDOR)
router.get('/:id', authMiddleware, authMiddleware.ensureSameUserOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ user });
  } catch (err) {
    console.error('GET /api/users/:id error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/users/:id  (update profile, only owner or admin)
router.put('/:id', authMiddleware, authMiddleware.ensureSameUserOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {};
    if (req.body.username) updates.username = req.body.username;
    if (req.body.email) updates.email = req.body.email; // you can add email validation here

    const user = await User.findByIdAndUpdate(id, updates, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ user });
  } catch (err) {
    console.error('PUT /api/users/:id error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;