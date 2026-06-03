'use strict';
/**
 * Usuario Controller
 */
const usuarioService = require('./usuario.service');

class UsuarioController {
  /** GET /api/usuarios */
  async listar(req, res) {
    const usuarios = await usuarioService.listarUsuarios();
    return res.json({ ok: true, data: { usuarios } });
  }

  /** POST /api/usuarios */
  async crear(req, res) {
    const usuario = await usuarioService.crearUsuario(req.body);
    return res.status(201).json({ ok: true, message: 'Usuario creado exitosamente', data: { usuario } });
  }

  /** PATCH /api/usuarios/:username/estado */
  async cambiarEstado(req, res) {
    const { username } = req.params;
    const { activo } = req.body;
    const updated = await usuarioService.cambiarEstado(username, activo, req.user.usuario);
    return res.json({ ok: true, message: `Usuario ${activo ? 'activado' : 'desactivado'}`, data: { usuario: updated } });
  }

  /** PATCH /api/usuarios/perfil */
  async editarPerfil(req, res) {
    const updated = await usuarioService.editarPerfil(req.user.usuario, req.body);
    return res.json({ ok: true, message: 'Perfil actualizado', data: { usuario: updated } });
  }

  /** PATCH /api/usuarios/contrasena */
  async cambiarContrasena(req, res) {
    const { passwordActual, passwordNueva } = req.body;
    await usuarioService.cambiarContrasena(req.user.usuario, passwordActual, passwordNueva);
    return res.json({ ok: true, message: 'Contraseña actualizada exitosamente' });
  }

  /** PATCH /api/usuarios/:username/vinculacion */
  async vincularComunidad(req, res) {
    const { username } = req.params;
    const { numero_documento } = req.body;
    const updated = await usuarioService.vincularComunidad(username, numero_documento);
    const accion = numero_documento ? 'vinculado a Comunidad' : 'desvinculado de Comunidad';
    return res.json({ ok: true, message: `Usuario ${accion}`, data: { usuario: updated } });
  }
}

module.exports = new UsuarioController();
