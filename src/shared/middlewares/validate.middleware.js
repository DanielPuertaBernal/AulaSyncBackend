'use strict';
/**
 * Validate Middleware - Valida body con un schema Zod
 */

/**
 * Retorna middleware que valida req.body contra un schema Zod
 * @param {import('zod').ZodSchema} schema
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        campo: e.path.join('.'),
        mensaje: e.message,
      }));
      return res.status(400).json({ ok: false, message: 'Datos inválidos', errors });
    }
    req.body = result.data; // datos limpios y tipados
    next();
  };
}

module.exports = { validate };
