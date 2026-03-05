'use strict';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Extrae parámetros de paginación desde query params.
 * Si no se envían, retorna null (sin paginación).
 */
function parsePagination(query = {}) {
  const page = parseInt(query.page, 10);
  const limit = parseInt(query.limit, 10);
  if (!page || page < 1) return null;
  return {
    page,
    limit: Math.min(Math.max(limit || DEFAULT_LIMIT, 1), MAX_LIMIT),
  };
}

/**
 * Aplica paginación a un Mongoose query.
 * @param {import('mongoose').Query} mongooseQuery
 * @param {{ page: number, limit: number } | null} pagination
 * @returns {Promise<{ data: any[], meta?: { page, limit, total } }>}
 */
async function applyPagination(mongooseQuery, pagination) {
  if (!pagination) {
    const data = await mongooseQuery.lean();
    return { data };
  }

  const { page, limit } = pagination;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    mongooseQuery.clone().skip(skip).limit(limit).lean(),
    mongooseQuery.clone().countDocuments(),
  ]);

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

module.exports = { parsePagination, applyPagination, DEFAULT_LIMIT, MAX_LIMIT };
