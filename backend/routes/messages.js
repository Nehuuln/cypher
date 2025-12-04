const express = require('express');
const router = express.Router();
const multer = require('multer');
const { fileTypeFromBuffer } = require('file-type');
const { v4: uuidv4 } = require('uuid');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ffmpeg = require('fluent-ffmpeg');
const ffprobeStatic = require('ffprobe-static');

ffmpeg.setFfprobePath(ffprobeStatic.path);

// increase file size limit to allow short videos (e.g. up to ~50MB)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// helper: ensure participant
async function ensureParticipant(req, res, next) {
  try {
    const convId = req.params.id || req.body.conversationId;
    if (!convId) return res.status(400).json({ message: 'Missing conversation id' });
    const conv = await Conversation.findById(convId).select('participants');
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });
    const me = req.user?.id;
    if (!me) return res.status(401).json({ message: 'Unauthorized' });
    const isPart = conv.participants.some(p => String(p) === String(me));
    if (!isPart) return res.status(403).json({ message: 'Forbidden' });
    req.conversation = conv;
    next();
  } catch (err) {
    console.error('ensureParticipant error:', err);
    res.status(500).json({ message: 'Server error' });
  }
}

// GET /api/messages -> liste des conversations de l'utilisateur (meta)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;
    const convs = await Conversation.find({ participants: me })
      .select('participants lastMessageAt messages')
      .populate('participants', 'username avatar')
      .sort({ lastMessageAt: -1 })
      .lean();
    const list = convs.map(c => {
      const last = (c.messages && c.messages.length) ? c.messages[c.messages.length - 1] : null;
      const unread = (c.messages || []).filter(m => !(m.readBy || []).some(r => String(r) === String(me))).length;
      return {
        _id: c._id,
        participants: c.participants,
        lastMessage: last ? { text: last.text, sender: last.sender, createdAt: last.createdAt } : null,
        lastMessageAt: c.lastMessageAt,
        unread
      };
    });
    res.json({ conversations: list });
  } catch (err) {
    console.error('GET /api/messages error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/messages/start -> start conversation with other user
router.post('/start', authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;
    const otherTag = (req.body.tag || '').toString().trim();
    if (!otherTag) return res.status(400).json({ message: 'Missing tag' });
    // find user by tag instead of by id
    const other = await User.findOne({ tag: otherTag }).select('_id username');
    if (!other) return res.status(404).json({ message: 'User not found (by tag)' });
    if (String(other._id) === String(me)) return res.status(400).json({ message: 'Cannot start conversation with yourself' });

    let conv = await Conversation.findOne({ participants: { $all: [me, other._id], $size: 2 } });
    if (!conv) {
      conv = new Conversation({ participants: [me, other._id], messages: [] });
      await conv.save();
    }
    return res.status(201).json({ conversationId: conv._id });
  } catch (err) {
    console.error('POST /api/messages/start error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/messages/:id -> get messages 
router.get('/:id', authMiddleware, ensureParticipant, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id)
      .populate('messages.sender', 'username avatar')
      .populate('participants', 'username avatar')
      .lean();
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });
    res.json({ conversation: conv });
  } catch (err) {
    console.error('GET /api/messages/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/messages/:id -> send message 
router.post('/:id', authMiddleware, ensureParticipant, upload.array('attachments', 3), async (req, res) => {
  try {
    const me = req.user.id;
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });

    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    const attachments = [];

    const allowedMimes = ['image/jpeg', 'image/png', 'application/pdf', 'video/mp4', 'video/webm'];
    const allowedExts = ['jpg', 'jpeg', 'png', 'pdf', 'mp4', 'webm'];

    if (req.files && req.files.length) {
      for (const f of req.files) {
        const ft = await fileTypeFromBuffer(f.buffer);
        if (!ft) {
          console.warn('Attachment rejected: unknown file type', { originalName: f.originalname });
          return res.status(400).json({ message: 'Type de fichier non autorisé (impossible de déterminer le type).' });
        }

        if (!allowedMimes.includes(ft.mime)) {
          console.warn('Attachment rejected: mime not allowed', { mime: ft.mime, originalName: f.originalname });
          return res.status(400).json({ message: 'Type MIME non autorisé.' });
        }

        if (!allowedExts.includes(ft.ext.toLowerCase())) {
          console.warn('Attachment rejected: extension from buffer not allowed', { ext: ft.ext, originalName: f.originalname });
          return res.status(400).json({ message: 'Extension non autorisée.' });
        }

        const origExt = (path.extname(f.originalname) || '').replace('.', '').toLowerCase();
        if (origExt && !allowedExts.includes(origExt)) {
          console.warn('Attachment rejected: original extension not allowed', { origExt, originalName: f.originalname });
          return res.status(400).json({ message: 'Extension du fichier original non autorisée.' });
        }

        let videoDuration = null;
        if (ft.mime.startsWith('video/')) {
          const tmpPath = path.join(os.tmpdir(), `${uuidv4()}.${ft.ext}`);
          try {
            await fs.promises.writeFile(tmpPath, f.buffer);
            const metadata = await new Promise((resolve, reject) => {
              ffmpeg.ffprobe(tmpPath, (err, meta) => {
                if (err) return reject(err);
                resolve(meta);
              });
            });
            videoDuration = metadata && metadata.format && metadata.format.duration ? Number(metadata.format.duration) : null;
            if (videoDuration === null) {
              console.warn('Could not determine video duration, rejecting', { originalName: f.originalname });
              await fs.promises.unlink(tmpPath).catch(() => {});
              return res.status(400).json({ message: 'Impossible de déterminer la durée de la vidéo.' });
            }
            if (videoDuration > 60) {
              console.warn('Attachment rejected: video too long', { duration: videoDuration, originalName: f.originalname });
              await fs.promises.unlink(tmpPath).catch(() => {});
              return res.status(400).json({ message: 'Vidéo trop longue (max 60s).' });
            }
          } catch (e) {
            console.error('Error probing video file', e);
            await fs.promises.unlink(tmpPath).catch(() => {});
            return res.status(500).json({ message: 'Erreur lors de la validation de la vidéo.' });
          }
          await fs.promises.unlink(tmpPath).catch(() => {});
        }

        const attachment = {
          filename: `${uuidv4()}.${ft.ext}`,
          contentType: ft.mime,
          size: f.size,
          data: f.buffer
        };
        if (videoDuration !== null) attachment.duration = videoDuration;
        attachments.push(attachment);
      }
    }

    const msg = {
      sender: me,
      text,
      attachments,
      createdAt: new Date(),
      readBy: [me]
    };
    conv.messages.push(msg);
    conv.lastMessageAt = new Date();
    await conv.save();

    try {
      const io = req.app.get('io');
      if (io) {
        conv.participants.forEach(pid => {
          io.to(String(pid)).emit('message:new', {
            conversationId: conv._id,
            message: { ...msg, sender: me }
          });
        });
      }
    } catch (e) {
      console.error('Socket emit error:', e);
    }

    return res.json({ message: 'Message envoyé' });
  } catch (err) {
    console.error('POST /api/messages/:id error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/messages/:id/attachments/:filename -> serve attachment 
router.get('/:id/attachments/:filename', authMiddleware, ensureParticipant, async (req, res) => {
  try {
    const filename = req.params.filename;
    const conv = await Conversation.findById(req.params.id).select('messages').lean();
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });

    let found = null;
    for (const m of conv.messages || []) {
      const a = (m.attachments || []).find(x => String(x.filename) === String(filename));
      if (a) { found = a; break; }
    }
    if (!found) {
      const available = (conv.messages || []).flatMap(m => (m.attachments || []).map(a => a.filename));
      console.warn(`Attachment not found: requested=${filename} available=${JSON.stringify(available)}`);
      return res.status(404).json({ message: 'Attachment not found', available });
    }

    let dataBuf = null;
    if (Buffer.isBuffer(found.data)) {
      dataBuf = found.data;
    } else if (found.data && found.data.buffer) {
      dataBuf = Buffer.from(found.data.buffer);
    } else if (found.data && Array.isArray(found.data.data)) {
      dataBuf = Buffer.from(found.data.data);
    } else {
      console.error('Attachment data format not recognized', found);
      return res.status(500).json({ message: 'Invalid attachment data' });
    }

    const total = dataBuf.length;
    const contentType = found.contentType || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${found.filename}"`);
    res.setHeader('Accept-Ranges', 'bytes');

    const range = req.headers.range;
    if (range && String(contentType).startsWith('video/')) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10) || 0;
      const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
      if (isNaN(start) || isNaN(end) || start > end || start >= total) {
        res.status(416).setHeader('Content-Range', `bytes */${total}`).end();
        return;
      }
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      res.setHeader('Content-Length', end - start + 1);
      return res.send(dataBuf.slice(start, end + 1));
    }

    res.setHeader('Content-Length', total);
    return res.send(dataBuf);
  } catch (err) {
    console.error('GET /api/messages/:id/attachments/:filename error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id/attachments', authMiddleware, ensureParticipant, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id).select('messages').lean();
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });
    const files = (conv.messages || []).flatMap(m => (m.attachments || []).map(a => ({ filename: a.filename, contentType: a.contentType })));
    return res.json({ attachments: files });
  } catch (err) {
    console.error('DEBUG GET /api/messages/:id/attachments error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;