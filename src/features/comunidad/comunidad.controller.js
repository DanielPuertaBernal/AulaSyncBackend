'use strict';
const comunidadService = require('./comunidad.service');

class ComunidadController {
  async listar(req, res) {
    const { q, tipo } = req.query;
    const personas = q
      ? await comunidadService.buscar(q, tipo)
      : await comunidadService.listar(tipo);
    return res.json({ ok: true, data: { personas } });
  }

  async obtener(req, res) {
    const persona = await comunidadService.buscarPorDocumento(req.params.documento);
    return res.json({ ok: true, data: { persona } });
  }

  async obtenerPorCarnet(req, res) {
    const persona = await comunidadService.buscarPorCarnet(req.params.idCarnet);
    return res.json({ ok: true, data: { persona } });
  }

  async sync(req, res) {
    const resultado = await comunidadService.sync(req.body);
    return res.json({ ok: true, message: 'Sincronización completada', data: resultado });
  }
}

module.exports = new ComunidadController();
