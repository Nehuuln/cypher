const express = require("express");
const router = express.Router();
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");
const mongoose = require("mongoose");

// GET /api/admin/dashboard
router.get(
  "/dashboard",
  authMiddleware,
  authMiddleware.adminOnly,
  (req, res) => {
    return res.json({ message: "Admin dashboard" });
  }
);

// GET /api/admin/users - liste des utilisateurs (sans password)
router.get(
  "/users",
  authMiddleware,
  authMiddleware.adminOnly,
  async (req, res) => {
    try {
      const users = await User.find().select("-password");
      return res.json({ users });
    } catch (err) {
      console.error("GET /api/admin/users error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

// GET /api/admin/users/:id - récupérer un utilisateur par ID (admin only)
router.get(
  "/users/:id",
  authMiddleware,
  authMiddleware.adminOnly,
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ message: "ID manquant" });

      const user = await User.findById(id).select("-password");
      if (!user)
        return res.status(404).json({ message: "Utilisateur introuvable" });

      return res.json({ user });
    } catch (err) {
      console.error("GET /api/admin/users/:id error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

// /api/admin/users/:id/role - changer le rôle d'un utilisateur
router.patch(
  "/users/:id/role",
  authMiddleware,
  authMiddleware.adminOnly,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body; 

      if (!["admin", "user"].includes(role)) {
        return res.status(400).json({ message: "Rôle invalide" });
      }
      if (!id) return res.status(400).json({ message: "ID manquant" });
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "ID invalide" });
      }

      const user = await User.findById(id);
      if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

      // empêcher de retirer son propre rôle admin (optionnel)
      if (String(req.user.id) === String(user._id) && role === "user") {
        return res.status(400).json({ message: "Vous ne pouvez pas retirer votre propre rôle admin." });
      }

      user.roles = role === "admin" ? ["admin"] : ["user"];
      await user.save();

      const sanitized = await User.findById(user._id).select("-password");
      return res.json({ user: sanitized });
    } catch (err) {
      console.error("PATCH /api/admin/users/:id/role error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

// /api/admin/users/:id/ban - bannir un utilisateur
router.patch(
  "/users/:id/ban",
  authMiddleware,
  authMiddleware.adminOnly,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { durationMinutes, reason } = req.body;

      if (!id) return res.status(400).json({ message: "ID manquant" });
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "ID invalide" });
      }

      const user = await User.findById(id);
      if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

      const isTargetAdmin = Array.isArray(user.roles) && user.roles.some(r => String(r).toLowerCase() === 'admin');
      if (isTargetAdmin) return res.status(403).json({ message: "Impossible de bannir un admin." });

      const minutes = Number(durationMinutes);
      if (Number.isNaN(minutes) || minutes < 0) {
        return res.status(400).json({ message: "Durée invalide" });
      }

      if (minutes === 0) {
        user.bannedUntil = null;
        user.bannedReason = "";
      } else {
        user.bannedUntil = new Date(Date.now() + minutes * 60 * 1000);
        user.bannedReason = String(reason || "");
      }

      await user.save();
      const sanitized = await User.findById(user._id).select("-password");
      return res.json({ user: sanitized });
    } catch (err) {
      console.error("PATCH /api/admin/users/:id/ban error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
