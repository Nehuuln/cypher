const express = require('express');
const router = express.Router();
const multer = require('multer');
const { fileTypeFromBuffer } = require('file-type');
const { v4: uuidv4 } = require('uuid');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

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
    const otherId = req.body.userId;
    if (!otherId) return res.status(400).json({ message: 'Missing userId' });
    if (String(otherId) === String(me)) return res.status(400).json({ message: 'Cannot start conversation with yourself' });
    const other = await User.findById(otherId).select('_id username');
    if (!other) return res.status(404).json({ message: 'User not found' });
    let conv = await Conversation.findOne({ participants: { $all: [me, otherId], $size: 2 } });
    if (!conv) {
      conv = new Conversation({ participants: [me, otherId], messages: [] });
      await conv.save();
    }
    return res.status(201).json({ conversationId: conv._id });
  } catch (err) {
    console.error('POST /api/messages/start error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/messages/:id -> get messages (with senders populated)
router.get('/:id', authMiddleware, ensureParticipant, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id)
      .populate('messages.sender', 'username avatar')
      .lean();
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });
    res.json({ conversation: conv });
  } catch (err) {
    console.error('GET /api/messages/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/messages/:id -> send message (text + optional attachments)
router.post('/:id', authMiddleware, ensureParticipant, upload.array('attachments', 3), async (req, res) => {
  try {
    const me = req.user.id;
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });

    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    const attachments = [];
    if (req.files && req.files.length) {
      for (const f of req.files) {
        const ft = await fileTypeFromBuffer(f.buffer);
        if (!ft) return res.status(400).json({ message: 'Invalid attachment type' });
        const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!allowed.includes(ft.mime)) return res.status(400).json({ message: 'Attachment mime not allowed' });
        attachments.push({
          filename: `${uuidv4()}.${ft.ext}`,
          contentType: ft.mime,
          size: f.size,
          data: f.buffer
        });
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

    return res.status(201).json({ message: 'Sent', conversationId: conv._id });
  } catch (err) {
    console.error('POST /api/messages/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/messages/:id/attachments/:filename -> serve attachment (participant only)
router.get('/:id/attachments/:filename', authMiddleware, ensureParticipant, async (req, res) => {
  try {
    const filename = req.params.filename;
    const conv = await Conversation.findById(req.params.id).select('messages').lean();
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });

    let found = null;
    for (const m of conv.messages || []) {
      const a = (m.attachments || []).find(x => String(x.filename) === String(filename));
      if (a) {
        found = a;
        break;
      }
    }
    if (!found) {
      const available = (conv.messages || []).flatMap(m => (m.attachments || []).map(a => a.filename));
      console.warn(`Attachment not found: requested=${filename} available=${JSON.stringify(available)}`);
      return res.status(404).json({ message: 'Attachment not found', available });
    }

    let dataBuf = null;
    try {
      if (Buffer.isBuffer(found.data)) {
        dataBuf = found.data;
      } else if (found.data && found.data.buffer) {
        dataBuf = Buffer.from(found.data.buffer);
      } else if (found.data && Array.isArray(found.data.data)) {
        dataBuf = Buffer.from(found.data.data);
      } else if (typeof found.data === 'string') {
        try {
          dataBuf = Buffer.from(found.data, 'base64');
          if (!dataBuf || dataBuf.length === 0) dataBuf = Buffer.from(found.data);
        } catch (e) {
          dataBuf = Buffer.from(found.data);
        }
      }
    } catch (e) {
      console.error('Error normalizing attachment data for', found.filename, e);
    }

    if (!dataBuf) {
      console.warn('Attachment data could not be normalized', { filename: found.filename, type: typeof found.data });
      return res.status(500).json({ message: 'Attachment data invalid' });
    }

    console.log(`Serving attachment ${found.filename} (${found.contentType}) size=${dataBuf.length}`);
    res.set('Content-Type', found.contentType || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename="${found.filename}"`);
    res.set('Content-Length', String(dataBuf.length));
    return res.send(dataBuf);
  } catch (err) {
    console.error('GET /api/messages/:id/attachments/:filename error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// DEBUG endpoint: list attachments filenames for a conversation (participant only)
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