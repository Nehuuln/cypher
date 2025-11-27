const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  roles: { type: [String], default: ["user"] },
  bio: { type: String, default: "", maxlength: 1000 },
});

module.exports = mongoose.model("User", userSchema);
