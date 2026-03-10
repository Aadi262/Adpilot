'use strict';

class AppError extends Error {
  constructor(message, statusCode = 500, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg, code)    { return new AppError(msg, 400, code); }
  static unauthorized(msg)        { return new AppError(msg || 'Unauthorized', 401); }
  static forbidden(msg)           { return new AppError(msg || 'Forbidden', 403); }
  static notFound(resource)       { return new AppError(`${resource || 'Resource'} not found`, 404); }
  static conflict(msg)            { return new AppError(msg, 409); }
  static unprocessable(msg)       { return new AppError(msg, 422); }
  static tooManyRequests(msg)     { return new AppError(msg || 'Too many requests', 429); }
  static serviceUnavailable(msg)  { return new AppError(msg || 'Service unavailable', 503); }
  static internal(msg)            { return new AppError(msg || 'Internal server error', 500); }
}

module.exports = AppError;
