const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePasswordPolicy(password) {
  if (!password || password.length < 12) return { ok: false, message: 'Le mot de passe doit contenir au moins 12 caractères.' };
  let classes = 0;
  if (/[A-Z]/.test(password)) classes++;
  if (/[a-z]/.test(password)) classes++;
  if (/\d/.test(password)) classes++;
  if (/[^A-Za-z0-9]/.test(password)) classes++;
  if (classes < 3) return { ok: false, message: 'Le mot de passe doit contenir au moins 3 types de caractères : majuscules, minuscules, chiffres, spéciaux.' };
  return { ok: true };
}

// POST /api/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ message: 'Email invalide.' });
    }

    const passCheck = validatePasswordPolicy(password);
    if (!passCheck.ok) {
      return res.status(400).json({ message: passCheck.message });
    }

    // Check existing user
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return res.status(409).json({ message: 'Username or email already taken' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashed });
    await user.save();

    return res.status(201).json({ message: 'User created', id: user._id });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
