const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const crypto = require("crypto");
const authMiddleware = require("../middleware/auth");

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePasswordPolicy(password) {
  if (!password || password.length < 12)
    return {
      ok: false,
      message: "Le mot de passe doit contenir au moins 12 caractères.",
    };
  let classes = 0;
  if (/[A-Z]/.test(password)) classes++;
  if (/[a-z]/.test(password)) classes++;
  if (/\d/.test(password)) classes++;
  if (/[^A-Za-z0-9]/.test(password)) classes++;
  if (classes < 3)
    return {
      ok: false,
      message:
        "Le mot de passe doit contenir au moins 3 types de caractères : majuscules, minuscules, chiffres, spéciaux.",
    };
  return { ok: true };
}

// POST /api/register
router.post("/register", async (req, res) => {
  try {
    const { username, email, password, consent } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!consent) {
      return res.status(400).json({ message: "Consentement requis pour l'inscription" });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ message: "Email invalide." });
    }

    const passCheck = validatePasswordPolicy(password);
    if (!passCheck.ok) {
      return res.status(400).json({ message: passCheck.message });
    }

    // Check existing user
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return res
        .status(409)
        .json({ message: "Username or email already taken" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashed });
    await user.save();

    return res.status(201).json({ message: "User created", id: user._id });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Champs requis manquants" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ message: "Identifiants invalides" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ message: "Identifiants invalides" });

    const payload = {
      id: user._id.toString(),
      roles: user.roles,
      iat: Math.floor(Date.now() / 1000),
    };
    const secret = process.env.JWT_SECRET || "dev-secret";
    const base = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = crypto
      .createHmac("sha256", secret)
      .update(base)
      .digest("base64url");
    const token = `${base}.${sig}`;

    // set cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      path: "/",
      maxAge: 1000 * 60 * 1, // 30 minutes
    });

    return res.status(200).json({ message: "Authentifié" });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/logout
router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    path: "/",
  });
  return res.status(200).json({ message: "Déconnecté" });
});

// Protected route example
router.get("/me", authMiddleware, async (req, res) => {
  // req.user is set by middleware
  const { id } = req.user || {};
  try {
    const user = await User.findById(id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({ user });
  } catch (err) {
    console.error("GET /me error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
