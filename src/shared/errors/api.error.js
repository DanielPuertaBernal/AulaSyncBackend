'use strict';

class ApiError extends Error {
  constructor(message, statusCode = 500, data = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    if (data !== null) this.data = data;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message = 'Solicitud inválida') {
    return new ApiError(message, 400);
  }

  static unauthorized(message = 'No autorizado') {
    return new ApiError(message, 401);
  }

  static forbidden(message = 'Acceso denegado') {
    return new ApiError(message, 403);
  }

  static notFound(message = 'Recurso no encontrado') {
    return new ApiError(message, 404);
  }

  static conflict(message = 'Conflicto de datos', data = null) {
    return new ApiError(message, 409, data);
  }
}

module.exports = ApiError;
