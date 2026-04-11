'use strict';
/**
 * Auth Middleware - Verifica JWT y permisos por rol
 * Equivale a application/auth/decorators.py (require_role)
 */
const jwt = require('jsonwebtoken');
const { ROLES } = require('./auth.schema');
const usuarioRepository = require('../usuarios/usuario.repository');

const JWT_ISSUER = process.env.JWT_ISSUER || 'aulasync-api';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'aulasync-clients';

/**
 * Middleware: verifica el token JWT en el header Authorization
 */
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, message: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    if (payload?.type !== 'access') {
      return res.status(401).json({ ok: false, message: 'Tipo de token inválido' });
    }

    const currentUser = await usuarioRepository.findById(payload.sub);
    if (!currentUser || !currentUser.activo) {
      return res.status(401).json({ ok: false, message: 'Usuario no autorizado o inactivo' });
    }

    req.user = {
      sub: currentUser._id.toString(),
      usuario: currentUser.usuario,
      rol: currentUser.rol,
      nombre: currentUser.nombre,
      type: 'access',
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ ok: false, message: 'Token expirado' });
    }
    return res.status(401).json({ ok: false, message: 'Token inválido' });
  }
}

/**
 * Middleware factory: requiere un rol específico
 * Equivale a @require_role(RolUsuario.ADMIN_PROG)
 * @param {...string} roles - Roles permitidos
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, message: 'No autenticado' });
    }
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({
        ok: false,
        message: `Acceso denegado. Se requiere rol: ${roles.join(' o ')}`,
      });
    }
    next();
  };
}

/**
 * Shorthand: solo ADMIN_PROG
 */
const requireAdmin = [verifyToken, requireRole(ROLES.ADMIN)];

/**
 * Shorthand: cualquier usuario autenticado (ADMIN o AUX)
 */
const requireAuth = [verifyToken];

/**
 * Shorthand: solo AUX_PROG
 */
const requireAux = [verifyToken, requireRole(ROLES.AUX)];

module.exports = { verifyToken, requireRole, requireAdmin, requireAuth, requireAux, ROLES };
