const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  roles: { type: [String], default: ["user"] },
  bio: { type: String, default: "", maxlength: 1000 },
  // Avatar filename stored in backend/uploads (UUID + ext)
  avatar: { type: String, default: null },
});

module.exports = mongoose.model("User", userSchema);
