const mongoose = require("mongoose");
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  roles: { type: [String], default: ["user"] },
  bio: { type: String, default: "", maxlength: 1000 },
  
  // RGPD fields
  consentGiven: { type: Boolean, default: false },
  consentAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },
  isAnonymized: { type: Boolean, default: false },
});

// Instance method to anonymize the user (right to be forgotten)
userSchema.methods.anonymize = async function () {
  const random = crypto.randomBytes(12).toString('hex');
  // Replace PII
  this.username = `deleted_${this._id}_${random.slice(0,6)}`;
  this.email = `deleted+${this._id}@example.invalid`;
  this.bio = '';
  this.roles = [];
  this.deletedAt = new Date();
  this.isAnonymized = true;

  // Replace password with a random hash
  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(random + Date.now().toString(), salt);
  this.password = hashed;

  await this.save();
  return this;
};

// Strip sensitive fields when converting to JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
