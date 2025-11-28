const express = require("express");
const router = express.Router();
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");

// petit utilitaire d'échappement HTML pour prévenir le stored XSS
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\//g, "&#x2F;");
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/users/:id  (protected, prevents IDOR)
router.get(
  "/:id",
  authMiddleware,
  authMiddleware.ensureSameUserOrAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const user = await User.findById(id).select("-password");
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json({ user });
    } catch (err) {
      console.error("GET /api/users/:id error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

// PUT /api/users/:id  (update profile, only owner or admin)
router.put(
  "/:id",
  authMiddleware,
  authMiddleware.ensureSameUserOrAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates = {};

      // username validation
      if (req.body.username !== undefined) {
        if (
          typeof req.body.username !== "string" ||
          req.body.username.trim().length < 3
        ) {
          return res
            .status(400)
            .json({ message: "Username invalide (min 3 caractères)." });
        }
        updates.username = req.body.username.trim();
      }

      // email validation
      if (req.body.email !== undefined) {
        if (
          typeof req.body.email !== "string" ||
          !emailRegex.test(req.body.email)
        ) {
          return res.status(400).json({ message: "Email invalide." });
        }
        updates.email = req.body.email.toLowerCase().trim();
      }

      // bio validation + sanitation (empêche <script> stocké)
      if (req.body.bio !== undefined) {
        if (typeof req.body.bio !== "string") {
          return res.status(400).json({ message: "Bio invalide." });
        }
        if (req.body.bio.length > 1000) {
          return res
            .status(400)
            .json({ message: "Bio trop longue (max 1000 caractères)." });
        }
        updates.bio = escapeHtml(req.body.bio);
      }

      // avatar filename (optional) - set when uploaded via uploads endpoint
      if (req.body.avatar !== undefined) {
        if (req.body.avatar && typeof req.body.avatar !== 'string') {
          return res.status(400).json({ message: 'Avatar invalide.' });
        }
        updates.avatar = req.body.avatar || null;
      }

      const user = await User.findByIdAndUpdate(id, updates, {
        new: true,
      }).select("-password");
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json({ user });
    } catch (err) {
      console.error("PUT /api/users/:id error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
