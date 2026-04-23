'use strict';
/**
 * Usuario Schema - Mongoose (re-exporta el de auth para no duplicar)
 */
const { Usuario, ROLES, passwordSchema } = require('../auth/auth.schema');
module.exports = { Usuario, ROLES, passwordSchema };
