const express = require("express");
const router = express.Router();
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");
const multer = require("multer");
const { fileTypeFromBuffer } = require("file-type");
const { v4: uuidv4 } = require("uuid");

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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 } // 2 MB
});

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

router.get("/:id/avatar", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("avatar").lean();
    if (!user || !user.avatar || !user.avatar.data) {
      return res.status(404).json({ message: "Avatar not found" });
    }

    const ad = user.avatar.data;
    let buf = null;
    if (Buffer.isBuffer(ad)) {
      buf = ad;
    } else if (ad && ad.buffer) {
      buf = Buffer.from(ad.buffer);
    } else if (ad && Array.isArray(ad.data)) {
      buf = Buffer.from(ad.data);
    } else if (Array.isArray(ad)) {
      buf = Buffer.from(ad);
    } else {
      console.error("GET /api/users/:id/avatar: unknown avatar.data format", typeof ad);
      return res.status(500).json({ message: "Invalid avatar data" });
    }

    res.set("Content-Type", user.avatar.contentType || "application/octet-stream");
    res.set(
      "Content-Disposition",
      `inline; filename="${user.avatar.filename || "avatar"}"`
    );
    res.set("Content-Length", String(buf.length));
    return res.send(buf);
  } catch (err) {
    console.error("GET /api/users/:id/avatar error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/users/:id  (update profile, only owner or admin). Accepts optional avatar file (field name: avatar)
router.put(
  "/:id",
  authMiddleware,
  authMiddleware.ensureSameUserOrAdmin,
  upload.single("avatar"),
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

      if (req.file) {
        const ft = await fileTypeFromBuffer(req.file.buffer);
        const allowedMime = ["image/jpeg", "image/png", "application/pdf"];
        if (!ft || !allowedMime.includes(ft.mime)) {
          return res.status(400).json({ message: "Fichier non autorisé (mimetype invalide)." });
        }

        const ext = ft.ext; // 'jpg', 'png', 'pdf'
        const filename = `${uuidv4()}.${ext}`;

        updates.avatar = {
          data: req.file.buffer,
          contentType: ft.mime,
          filename,
          size: req.file.size
        };
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
