const express = require("express");
const router = express.Router();
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");
const multer = require("multer");
const { fileTypeFromBuffer } = require("file-type");
const { v4: uuidv4 } = require("uuid");

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\//g, "&#x2F;");
}

function sanitizeFilename(name) {
  try {
    const s = String(name || 'avatar');
    return s.replace(/[\r\n\"]/g, '_').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 200) || 'avatar';
  } catch (e) {
    return 'avatar';
  }
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

    const detected = await fileTypeFromBuffer(buf);
    const contentType = (detected && detected.mime) || user.avatar.contentType || "application/octet-stream";
    const filename = sanitizeFilename(user.avatar.filename || 'avatar');

    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Type', contentType);
    res.set('Content-Disposition', `inline; filename="${filename}"`);
    res.set('Content-Length', String(buf.length));
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

      // tag is not editable
      if (req.body.tag !== undefined) {
        return res.status(400).json({ message: "Tag cannot be modified." });
      }

      // username validation & uniqueness
      if (req.body.username !== undefined) {
        if (typeof req.body.username !== "string" || req.body.username.trim().length < 3) {
          return res.status(400).json({ message: "Username invalide (min 3 caractères)." });
        }
        const usernameTrim = req.body.username.trim();
        const exists = await User.findOne({ username: usernameTrim, _id: { $ne: id } }).lean();
        if (exists) return res.status(409).json({ message: "Username déjà utilisé." });
        updates.username = usernameTrim;
      }

      // email validation & uniqueness
      if (req.body.email !== undefined) {
        if (typeof req.body.email !== "string" || !emailRegex.test(req.body.email)) {
          return res.status(400).json({ message: "Email invalide." });
        }
        const emailNorm = req.body.email.toLowerCase().trim();
        const exists = await User.findOne({ email: emailNorm, _id: { $ne: id } }).lean();
        if (exists) return res.status(409).json({ message: "Email déjà utilisé." });
        updates.email = emailNorm;
      }

      // password (optional) -> require oldPassword (unless admin), validate minimal policy then hash
      if (req.body.password !== undefined && req.body.password !== "") {
        const pw = String(req.body.password);

        // check old password provided unless admin
        const requesterRoles = Array.isArray(req.user?.roles) ? req.user.roles : [];
        const isAdmin = requesterRoles.some(r => String(r).toLowerCase() === 'admin' || String(r).toLowerCase() === 'administrator');

        if (!isAdmin) {
          if (!req.body.oldPassword) {
            return res.status(400).json({ message: 'Ancien mot de passe requis pour changer le mot de passe.' });
          }
          // verify old password
          const existing = await User.findById(id).select('password').lean();
          if (!existing) return res.status(404).json({ message: 'User not found' });
          const bcrypt = require('bcryptjs');
          const ok = await bcrypt.compare(String(req.body.oldPassword), existing.password);
          if (!ok) {
            return res.status(401).json({ message: 'Ancien mot de passe incorrect.' });
          }
        }

        if (pw.length < 12) {
          return res.status(400).json({ message: "Le mot de passe doit contenir au moins 12 caractères." });
        }
        // simple complexity check (client already enforces); server-side minimal check
        let classes = 0;
        if (/[A-Z]/.test(pw)) classes++;
        if (/[a-z]/.test(pw)) classes++;
        if (/\d/.test(pw)) classes++;
        if (/[^A-Za-z0-9]/.test(pw)) classes++;
        if (classes < 3) {
          return res.status(400).json({ message: "Mot de passe doit contenir au moins 3 types de caractères." });
        }
        const hashed = await require("bcryptjs").hash(pw, 10);
        updates.password = hashed;
      }

      // bio -> sanitize / escape
      if (req.body.bio !== undefined) {
        if (typeof req.body.bio !== "string") return res.status(400).json({ message: "Bio invalide." });
        if (req.body.bio.length > 1000) return res.status(400).json({ message: "Bio trop longue (max 1000 caractères)." });
        updates.bio = escapeHtml(req.body.bio);
      }

      // avatar file (optional)
      if (req.file) {
        const ft = await fileTypeFromBuffer(req.file.buffer);
        const allowedMime = ["image/jpeg", "image/png"];
        if (!ft || !allowedMime.includes(ft.mime)) {
          return res.status(400).json({ message: "Fichier non autorisé (mimetype invalide). Seuls JPG/PNG." });
        }
        const ext = ft.ext;
        const filename = `${uuidv4()}.${ext}`;
        updates.avatar = {
          data: req.file.buffer,
          contentType: ft.mime,
          filename,
          size: req.file.size
        };
      }

      const user = await User.findByIdAndUpdate(id, updates, { new: true }).select("-password").lean();
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json({ user });
    } catch (err) {
      console.error("PUT /api/users/:id error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

// Public GET /api/users/tag/:tag -> profile public by tag (no auth)
router.get('/tag/:tag', async (req, res) => {
  try {
    const tag = (req.params.tag || '').toString().trim();
    if (!tag) return res.status(400).json({ message: 'Tag manquant' });

    const user = await User.findOne({ tag })
      .select('_id username tag bio createdAt') 
      .lean();

    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

    return res.json({ user });
  } catch (err) {
    console.error('GET /api/users/tag/:tag error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
