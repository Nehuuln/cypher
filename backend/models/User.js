const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  roles: { type: [String], default: ["user"] },
  bio: { type: String, default: "", maxlength: 1000 },

  avatar: {
    data: Buffer,
    contentType: String,
    filename: String,
    size: Number
  },

  tag: { type: String, required: true, unique: true, index: true },

  bannedUntil: { type: Date, default: null },
  bannedReason: { type: String, default: "" }
});

module.exports = mongoose.model("User", userSchema);
