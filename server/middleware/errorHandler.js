const ApiError = require('../utils/ApiError');

// Never leak internal server errors/stack traces to the client (Section 57/58).
module.exports = function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ success: false, message: err.message, details: err.details });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: 'Invalid data provided.' });
  }
  if (err.code === 11000) {
    return res.status(409).json({ success: false, message: 'A record with these details already exists.' });
  }

  console.error('[unhandled error]', err);
  return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
};
