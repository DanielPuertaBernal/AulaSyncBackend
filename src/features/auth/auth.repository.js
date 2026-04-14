'use strict';
const { Usuario } = require('./auth.schema');

class AuthRepository {
  /** @param {string} username @returns {Promise<object|null>} Usuario con hash_password */
  async findByUsername(username) {
    return Usuario.findOne({ usuario: username }).select('+hash_password').lean();
  }

  /**
   * @param {string} userId
   * @param {object} sessionData - Datos de sesión (token_hash, user_agent, ip, etc.)
   * @param {number} maxSessions - Máximo de sesiones activas simultáneas
   * @returns {Promise<boolean>}
   */
  async addRefreshSession(userId, sessionData, maxSessions = 5) {
    const user = await Usuario.findById(userId).select('+sesiones');
    if (!user) return false;

    const now = new Date();
    const activas = (user.sesiones || [])
      .filter((session) => !session.revoked_at && new Date(session.expires_at) > now)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, Math.max(maxSessions - 1, 0));

    user.sesiones = [sessionData, ...activas];
    await user.save();
    return true;
  }

  /** @param {string} userId @param {string} tokenHash @returns {Promise<object|null>} */
  async findActiveRefreshSession(userId, tokenHash) {
    const user = await Usuario.findById(userId).select('+sesiones').lean();
    if (!user) return null;

    const now = new Date();
    return (user.sesiones || []).find((session) => (
      session.token_hash === tokenHash
      && !session.revoked_at
      && new Date(session.expires_at) > now
    )) || null;
  }

  /** @param {string} userId @param {string} tokenHash @returns {Promise<boolean>} */
  async revokeRefreshSession(userId, tokenHash) {
    const user = await Usuario.findById(userId).select('+sesiones');
    if (!user) return false;

    let changed = false;
    for (const session of user.sesiones || []) {
      if (session.token_hash === tokenHash && !session.revoked_at) {
        session.revoked_at = new Date();
        changed = true;
      }
    }

    if (changed) {
      await user.save();
    }
    return changed;
  }

  /** @param {string} userId @returns {Promise<boolean>} */
  async revokeAllRefreshSessions(userId) {
    const user = await Usuario.findById(userId).select('+sesiones');
    if (!user) return false;

    let changed = false;
    for (const session of user.sesiones || []) {
      if (!session.revoked_at) {
        session.revoked_at = new Date();
        changed = true;
      }
    }

    if (changed) {
      await user.save();
    }
    return changed;
  }
}

module.exports = new AuthRepository();
