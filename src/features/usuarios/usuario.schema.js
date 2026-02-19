'use strict';
/**
 * Usuario Schema - Mongoose (re-exporta el de auth para no duplicar)
 */
const { Usuario, ROLES } = require('../auth/auth.schema');
module.exports = { Usuario, ROLES };
