'use strict';
const comunidadService = require('./comunidad.service');

class ComunidadController {
  /** GET /api/comunidad?q&tipo - Lista o busca personas */
  async listar(req, res) {
    const { q, tipo } = req.query;
    const personas = q
      ? await comunidadService.buscar(q, tipo)
      : await comunidadService.listar(tipo);
    return res.json({ ok: true, data: { personas } });
  }

  /** GET /api/comunidad/:documento */
  async obtener(req, res) {
    const persona = await comunidadService.buscarPorDocumento(req.params.documento);
    return res.json({ ok: true, data: { persona } });
  }

  /** GET /api/comunidad/carnet/:idCarnet */
  async obtenerPorCarnet(req, res) {
    const persona = await comunidadService.buscarPorCarnet(req.params.idCarnet);
    return res.json({ ok: true, data: { persona } });
  }

  /** POST /api/comunidad/sync - Sincroniza registros desde sistema externo */
  async sync(req, res) {
    const resultado = await comunidadService.sync(req.body);
    return res.json({ ok: true, message: 'Sincronización completada', data: resultado });
  }
}

module.exports = new ComunidadController();
