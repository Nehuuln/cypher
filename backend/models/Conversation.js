const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, default: '' },
  attachments: [
    {
      filename: String,
      contentType: String,
      size: Number,
      data: Buffer
    }
  ],
  createdAt: { type: Date, default: Date.now },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  messages: [messageSchema],
  lastMessageAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
  ,
  // status: 'pending' when a requester starts a conversation and waits for acceptance
  status: { type: String, enum: ['pending', 'active', 'rejected'], default: 'active' },
  // who initiated the request (useful when status === 'pending')
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports = mongoose.model('Conversation', conversationSchema);