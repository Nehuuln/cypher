const crypto = require('crypto');
const mongoose = require('mongoose');

// Verify token from cookie and implement sliding expiration
function authMiddleware(req, res, next) {
  try {
    const token = req.cookies && req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const secret = process.env.JWT_SECRET || 'dev-secret';
    const parts = token.split('.');
    if (parts.length !== 2) return res.status(401).json({ message: 'Unauthorized' });

    const [base, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', secret).update(base).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    // timing-safe compare
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // parse payload
    let payload;
    try {
      payload = JSON.parse(Buffer.from(base, 'base64url').toString());
    } catch (e) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // check issued-at + timeout
    const iat = payload.iat || 0;
    const now = Math.floor(Date.now() / 1000);
    const timeoutMinutes = parseInt(process.env.SESSION_TIMEOUT_MINUTES) || 30;
    if (now - iat > timeoutMinutes * 60) {
      return res.status(401).json({ message: 'Session expired' });
    }

    // sliding expiration: reissue token with new iat and set cookie again
    const newPayload = { ...payload, iat: Math.floor(Date.now() / 1000) };
    const newBase = Buffer.from(JSON.stringify(newPayload)).toString('base64url');
    const newSig = crypto.createHmac('sha256', secret).update(newBase).digest('base64url');
    const newToken = `${newBase}.${newSig}`;

    // set refreshed cookie (30 minutes default or env)
    const sessionMinutes = parseInt(process.env.SESSION_TIMEOUT_MINUTES) || 30;
    res.cookie('token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      path: '/',
      maxAge: sessionMinutes * 60 * 1000
    });

    // attach user info to request for downstream handlers
    req.user = payload;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

function adminOnly(req, res, next) {
  try {
    const payload = req.user;
    if (!payload) return res.status(401).json({ message: 'Unauthorized' });
    const roles = Array.isArray(payload.roles) ? payload.roles : [];
    const isAdmin = roles.some(r => String(r).toLowerCase() === 'admin' || String(r).toLowerCase() === 'administrator');
    if (!isAdmin) return res.status(403).json({ message: 'Forbidden' });
    next();
  } catch (err) {
    console.error('adminOnly error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

function ensureSameUserOrAdmin(req, res, next) {
  try {
    const payload = req.user;
    if (!payload) return res.status(401).json({ message: 'Unauthorized' });
    const roles = Array.isArray(payload.roles) ? payload.roles : [];
    const isAdmin = roles.some(r => String(r).toLowerCase() === 'admin' || String(r).toLowerCase() === 'administrator');

    const requestedId = req.params?.id || req.body?.id || req.query?.id;
    if (!requestedId) return res.status(400).json({ message: 'Missing user id' });

    if (!mongoose.Types.ObjectId.isValid(requestedId)) {
      return res.status(400).json({ message: 'Invalid user id format' });
    }

    if (String(payload.id) === String(requestedId) || isAdmin) {
      return next();
    }
    return res.status(403).json({ message: 'Forbidden' });
  } catch (err) {
    console.error('ensureSameUserOrAdmin error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = authMiddleware;
module.exports.adminOnly = adminOnly;
module.exports.ensureSameUserOrAdmin = ensureSameUserOrAdmin;
