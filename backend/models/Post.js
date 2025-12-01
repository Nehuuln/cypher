const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  text: { type: String, default: '' },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  media: {
    data: Buffer,
    contentType: String,
    filename: String,
    size: Number,
    kind: { type: String, enum: ['image', 'video'] },
    duration: Number 
  }
});

module.exports = mongoose.model('Post', postSchema);