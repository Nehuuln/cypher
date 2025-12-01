module.exports = function errorHandler(err, req, res, next) {
  console.error('Unhandled error:', err);

  if (process.env.NODE_ENV === 'production') {
    return res.status(500).json({ message: 'Server error' });
  }

  return res.status(500).json({ message: err.message || 'Server error', stack: err.stack });
};