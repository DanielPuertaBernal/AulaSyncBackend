'use strict';
/**
 * Prestamo Service
 * Equivale a: application/services/prestamo_service.py
 *           + application/services/devolucion_service.py
 */
const mongoose = require('mongoose');
const { prestamoRepository, devolucionRepository } = require('./prestamo.repository');
const equipoRepository = require('../equipos/equipo.repository');

class PrestamoService {
  async listar() { return prestamoRepository.findAll(); }
  async activos() { return prestamoRepository.findActivos(); }
  async porDocente(codigoNfc) { return prestamoRepository.findByDocente(codigoNfc); }

  async obtener(id) {
    const p = await prestamoRepository.findById(id);
    if (!p) throw Object.assign(new Error('Préstamo no encontrado'), { statusCode: 404 });
    return p;
  }

  /**
   * Crea un nuevo préstamo de equipos
   * Equivale a PréstamoService.crear_prestamo (Python)
   * @param {object} datos
   */
  async crear({ docente_codigo_nfc, docente_nombre, equipos, auxiliar_prestamista }) {
    if (!equipos || !equipos.length) {
      throw Object.assign(new Error('Debe prestar al menos un equipo'), { statusCode: 400 });
    }

    // Normalizar equipos: acepta array de IDs o de objetos {equipo_id, ...}
    const equiposIds = this._normalizarEquipos(equipos);

    // Validar disponibilidad
    await this._validarDisponibilidad(equiposIds);

    // Construir detalles
    const detalles = await Promise.all(
      equiposIds.map(async (id) => {
        const equipo = await equipoRepository.findById(id);
        if (!equipo) throw Object.assign(new Error(`Equipo ${id} no encontrado`), { statusCode: 404 });
        return {
          equipo_id: new mongoose.Types.ObjectId(id),
          equipo_nombre: equipo.nombre,
          equipo_marca: equipo.marca,
          equipo_codigo: equipo.codigo_inventario,
          equipo_consecutivo: equipo.consecutivo,
          equipo_codigo_barras: equipo.codigo_barras,
          estado_equipo: 'entregado',
          fecha_entrega: new Date(),
        };
      })
    );

    return prestamoRepository.create({
      docente_codigo_nfc,
      docente_nombre,
      auxiliar_prestamista: auxiliar_prestamista || 'Auxiliar',
      equipos: detalles,
      estado: 'activo',
    });
  }

  /**
   * Agrega un equipo adicional a un préstamo existente
   */
  async agregarEquipo(prestamoId, equipoId, auxiliar) {
    const prestamo = await this.obtener(prestamoId);
    if (prestamo.estado === 'completamente_devuelto') {
      throw Object.assign(new Error('El préstamo ya fue devuelto completamente'), { statusCode: 400 });
    }

    await this._validarDisponibilidad([equipoId]);
    const equipo = await equipoRepository.findById(equipoId);
    if (!equipo) throw Object.assign(new Error('Equipo no encontrado'), { statusCode: 404 });

    const detalle = {
      equipo_id: new mongoose.Types.ObjectId(equipoId),
      equipo_nombre: equipo.nombre,
      equipo_marca: equipo.marca,
      equipo_codigo: equipo.codigo_inventario,
      equipo_consecutivo: equipo.consecutivo,
      equipo_codigo_barras: equipo.codigo_barras,
      estado_equipo: 'entregado',
      fecha_entrega: new Date(),
    };

    return prestamoRepository.addEquipo(prestamoId, detalle);
  }

  /**
   * Registra devolución (parcial o completa)
   * Equivale a DevolucionService.crear_devolucion (Python)
   */
  async registrarDevolucion({
    prestamo_id,
    docente_codigo_nfc,
    docente_nombre,
    equipos,
    auxiliar_que_recibio,
  }) {
    const prestamo = await this.obtener(prestamo_id);
    if (prestamo.estado === 'completamente_devuelto') {
      throw Object.assign(new Error('El préstamo ya fue devuelto completamente'), { statusCode: 400 });
    }

    // Si no se especifican equipos, devolver todos los pendientes
    const equiposADevolver = equipos && equipos.length
      ? this._normalizarEquipos(equipos)
      : prestamo.equipos
          .filter((e) => e.estado_equipo === 'entregado')
          .map((e) => String(e.equipo_id));

    const now = new Date();
    const equiposDevueltos = [];

    // Actualizar estado de cada equipo en el préstamo
    const equiposActualizados = prestamo.equipos.map((eq) => {
      const strId = String(eq.equipo_id);
      if (equiposADevolver.includes(strId) && eq.estado_equipo === 'entregado') {
        equiposDevueltos.push({
          equipo_id: eq.equipo_id,
          nombre: eq.equipo_nombre,
          cantidad: 1,
          estado: 'bueno',
        });
        return {
          ...eq,
          estado_equipo: 'devuelto',
          fecha_devolucion: now,
          auxiliar_que_recibio_devolucion: auxiliar_que_recibio || 'Auxiliar',
        };
      }
      return eq;
    });

    const aunEntregados = equiposActualizados.filter((e) => e.estado_equipo === 'entregado');
    const esCompleta = aunEntregados.length === 0;
    const nuevoEstado = esCompleta ? 'completamente_devuelto' : 'parcialmente_devuelto';

    // Actualizar préstamo
    await prestamoRepository.update(prestamo_id, {
      equipos: equiposActualizados,
      estado: nuevoEstado,
    });

    // Crear registro de devolución
    const devolucion = await devolucionRepository.create({
      prestamo_id: new mongoose.Types.ObjectId(prestamo_id),
      docente_codigo_nfc,
      docente_nombre,
      equipos_devueltos: equiposDevueltos,
      auxiliar_que_recibio: auxiliar_que_recibio || 'Auxiliar',
      es_devolucion_completa: esCompleta,
    });

    return { devolucion, prestamo_estado: nuevoEstado };
  }

  _normalizarEquipos(equipos) {
    return equipos.map((item) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object') {
        return String(item.equipo_id || item._id || item.id || '');
      }
      return String(item);
    }).filter(Boolean);
  }

  async _validarDisponibilidad(equipoIds) {
    for (const id of equipoIds) {
      const prestado = await prestamoRepository.verificarEquipoPrestado(id);
      if (prestado) {
        const eq = await equipoRepository.findById(id);
        throw Object.assign(
          new Error(`El equipo '${eq?.nombre || id}' ya está prestado`),
          { statusCode: 409 }
        );
      }
    }
  }
}

module.exports = new PrestamoService();
