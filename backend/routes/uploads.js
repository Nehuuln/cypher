const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const FileType = require('file-type');

const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// store in memory first to validate magic bytes before writing to disk
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const allowedExts = new Set(['jpg', 'jpeg', 'png', 'pdf']);
const allowedMimePrefixes = ['image/', 'application/pdf'];

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// POST /api/uploads/avatar/:id -> upload and set user's avatar
router.post('/avatar/:id', auth, auth.ensureSameUserOrAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const ft = await FileType.fromBuffer(req.file.buffer);
    const detectedMime = ft?.mime || req.file.mimetype || '';
    const detectedExt = (ft?.ext || '').toLowerCase();

    const extOk = detectedExt && allowedExts.has(detectedExt);
    const mimeOk = allowedMimePrefixes.some(p => detectedMime.startsWith(p));
    if (!extOk || !mimeOk) return res.status(400).json({ message: 'Invalid file type' });

    const filename = `${uuidv4()}.${detectedExt}`;
    const outPath = path.join(uploadsDir, filename);
    await fs.promises.writeFile(outPath, req.file.buffer, { flag: 'wx' });

    // update user avatar field
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.avatar = filename;
    await user.save();

    return res.status(201).json({ filename });
  } catch (err) {
    console.error('Upload avatar error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/uploads/image -> upload image for posts (returns filename)
router.post('/image', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const ft = await FileType.fromBuffer(req.file.buffer);
    const detectedMime = ft?.mime || req.file.mimetype || '';
    const detectedExt = (ft?.ext || '').toLowerCase();

    const extOk = detectedExt && allowedExts.has(detectedExt);
    const mimeOk = allowedMimePrefixes.some(p => detectedMime.startsWith(p));
    if (!extOk || !mimeOk) return res.status(400).json({ message: 'Invalid file type' });

    const filename = `${uuidv4()}.${detectedExt}`;
    const outPath = path.join(uploadsDir, filename);
    await fs.promises.writeFile(outPath, req.file.buffer, { flag: 'wx' });

    return res.status(201).json({ filename });
  } catch (err) {
    console.error('Upload image error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
