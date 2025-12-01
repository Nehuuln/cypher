const express = require('express');
const router = express.Router();
const multer = require('multer');
const { fileTypeFromBuffer } = require('file-type');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const ffprobeStatic = require('ffprobe-static');
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfprobePath(ffprobeStatic.path);

const Post = require('../models/Post');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max

const allowedImageMime = ['image/jpeg', 'image/png'];
const allowedVideoMime = ['video/mp4', 'video/webm', 'video/quicktime'];

// Create post. Auth required.
router.post('/', authMiddleware, upload.single('media'), async (req, res) => {
  try {
    const authorPayload = req.user;
    if (!authorPayload || !authorPayload.id) return res.status(401).json({ message: 'Unauthorized' });

    const text = (req.body.text || '').toString().trim();
    const post = { text, author: authorPayload.id };

    if (req.file) {
      const ft = await fileTypeFromBuffer(req.file.buffer);
      if (!ft) return res.status(400).json({ message: 'Impossible de déterminer le type de fichier.' });

      const mime = ft.mime;
      if (allowedImageMime.includes(mime)) {
        // image
        const ext = ft.ext;
        const filename = `${uuidv4()}.${ext}`;
        post.media = {
          data: req.file.buffer,
          contentType: mime,
          filename,
          size: req.file.size,
          kind: 'image'
        };
      } else if (allowedVideoMime.includes(mime)) {
        // video 
        const tmpPath = path.join(os.tmpdir(), `upload-${uuidv4()}.${ft.ext}`);
        await fs.writeFile(tmpPath, req.file.buffer);
        try {
          const metadata = await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(tmpPath, (err, meta) => {
              if (err) return reject(err);
              resolve(meta);
            });
          });
          const duration = (metadata.format && metadata.format.duration) ? Number(metadata.format.duration) : 0;
          if (isNaN(duration) || duration > 60) {
            await fs.unlink(tmpPath).catch(()=>{});
            return res.status(400).json({ message: 'La vidéo dépasse la durée autorisée (1 minute).' });
          }
          const ext = ft.ext;
          const filename = `${uuidv4()}.${ext}`;
          post.media = {
            data: req.file.buffer,
            contentType: mime,
            filename,
            size: req.file.size,
            kind: 'video',
            duration
          };
        } finally {
          await fs.unlink(tmpPath).catch(()=>{});
        }
      } else {
        return res.status(400).json({ message: 'Type de fichier non autorisé.' });
      }
    }

    const created = await Post.create(post);
    const populated = await Post.findById(created._id).populate('author', 'username');
    return res.status(201).json({ post: populated });
  } catch (err) {
    console.error('POST /api/posts error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const posts = await Post.find().select('-media.data').sort({ createdAt: -1 }).populate('author', 'username');
    return res.json({ posts });
  } catch (err) {
    console.error('GET /api/posts error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id/media', async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id).select('media');
    if (!post || !post.media || !post.media.data) return res.status(404).json({ message: 'Media not found' });
    res.set('Content-Type', post.media.contentType || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename="${post.media.filename || 'media'}"`);
    return res.send(post.media.data);
  } catch (err) {
    console.error('GET /api/posts/:id/media error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;