'use strict';
const configuracionService = require('./configuracion.service');

class ConfiguracionController {
  async listar(req, res) {
    const configuraciones = await configuracionService.listar();
    return res.json({ ok: true, data: { configuraciones } });
  }

  async obtener(req, res) {
    const { bloque } = req.params;
    const config = await configuracionService.obtenerPorBloque(bloque);
    return res.json({ ok: true, data: { configuracion: config } });
  }

  async defaults(req, res) {
    const defaults = await configuracionService.obtenerDefaults();
    return res.json({ ok: true, data: { defaults } });
  }

  async guardarDefaults(req, res) {
    const config = await configuracionService.guardarDefaults(req.body);
    return res.json({ ok: true, data: { defaults: config } });
  }

  async guardar(req, res) {
    const { bloque } = req.params;
    const config = await configuracionService.guardar(bloque, req.body);
    return res.json({ ok: true, data: { configuracion: config } });
  }

  async eliminar(req, res) {
    await configuracionService.eliminar(req.params.bloque);
    return res.json({ ok: true, message: 'Configuración eliminada' });
  }
}

module.exports = new ConfiguracionController();
