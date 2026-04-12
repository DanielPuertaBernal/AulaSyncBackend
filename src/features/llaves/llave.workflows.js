'use strict';

const ApiError = require('../../shared/errors/api.error');
const {
  calcularTiempoRetraso,
  esReclamoAnticipado,
} = require('../../shared/utils/date.helper');
const {
  normalizarDocumento,
  encontrarClaseActual,
  construirResultadoError,
  construirResultadoSinClase,
  construirResultadoAnticipado,
  construirResultadoPrestamo,
  construirResultadoDevolucion,
  construirRegistroEntregaManual,
} = require('./llave.domain');

function createLlaveWorkflows({
  buscarPersonaPorCarnet,
  resolverContextoNFC,
  buscarClaseParaConfirmacion,
  findPendienteByDocumento,
  findDocenteByDocumento,
  createRegistro,
  normalizarUbicacionPrestamo,
  normalizarUbicacionDevolucion,
  persistirPrestamo,
  persistirDevolucion,
  validarEntregaManual,
  normalizarOrigenRegistro,
}) {
  async function resolverResultadoDevolucion({ contexto, persona, documento, ubicacion }) {
    try {
      const ubicacionDevolucion = await normalizarUbicacionDevolucion(ubicacion);
      const result = await persistirDevolucion(contexto.prestamoActivo, {
        canal: 'carnet',
        quien: contexto.rol,
        documento,
        nombre: persona.nombre,
        ubicacion: ubicacionDevolucion,
      });

      return construirResultadoDevolucion({
        contexto,
        persona,
        result,
        ubicacion: ubicacionDevolucion,
      });
    } catch (err) {
      return construirResultadoError({ contexto, persona, mensaje: err.message });
    }
  }

  async function resolverResultadoPrestamo({ contexto, persona, documento, ubicacion }) {
    let ubicacionPrestamo;
    try {
      ubicacionPrestamo = await normalizarUbicacionPrestamo(ubicacion);
    } catch (err) {
      return construirResultadoError({ contexto, persona, mensaje: err.message });
    }

    if (!contexto.clasesDisponibles.length) {
      return construirResultadoSinClase({
        contexto,
        persona,
        mensaje: contexto.mensajeSinClase || 'No hay clases disponibles',
      });
    }

    const ahora = new Date();
    const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
    const claseTarget = encontrarClaseActual(contexto.clasesDisponibles, minutosAhora);

    if (!claseTarget) {
      return construirResultadoSinClase({
        contexto,
        persona,
        mensaje: 'No hay clases en el horario actual o próximo',
      });
    }

    const anticipado = esReclamoAnticipado(claseTarget.horario, ahora);
    const tiempoRetraso = calcularTiempoRetraso(claseTarget.horario, ahora);
    const seReclamoATiempo = !tiempoRetraso;

    if (anticipado) {
      return construirResultadoAnticipado({ contexto, persona, clase: claseTarget });
    }

    const registro = await persistirPrestamo({
      docente: contexto.docente,
      clase: claseTarget,
      seReclamoATiempo,
      tiempoRetraso,
      reclamaInfo: {
        quien: contexto.rol,
        documento,
        nombre: persona.nombre,
      },
      tipoEntrega: 'carnet',
      ubicacionPrestamo,
    });

    return construirResultadoPrestamo({
      contexto,
      persona,
      clase: claseTarget,
      registro,
      ubicacion: ubicacionPrestamo,
      seReclamoATiempo,
      tiempoRetraso,
    });
  }

  async function procesarLecturaNFC(idCarnet, ubicacion) {
    const persona = await buscarPersonaPorCarnet(idCarnet);
    if (!persona) {
      return { tipo: 'error', mensaje: 'Persona no encontrada para este carnet' };
    }

    const documento = normalizarDocumento(persona.numero_documento);
    const contexto = await resolverContextoNFC(persona, documento);

    if (contexto.prestamoActivo) {
      return resolverResultadoDevolucion({ contexto, persona, documento, ubicacion });
    }

    return resolverResultadoPrestamo({ contexto, persona, documento, ubicacion });
  }

  async function confirmarPrestamoAnticipado({
    id_carnet,
    horario,
    aula,
    rol,
    documento_persona,
    nombre_persona,
    ubicacion,
  }) {
    const ubicacionPrestamo = await normalizarUbicacionPrestamo(ubicacion);
    const persona = await buscarPersonaPorCarnet(id_carnet);
    if (!persona) {
      throw ApiError.notFound('Persona no encontrada');
    }

    const { clase, docenteDoc } = await buscarClaseParaConfirmacion({
      persona,
      aula,
      horario,
      rol,
    });

    if (!clase) {
      throw ApiError.notFound('Clase no encontrada en la programación');
    }

    const existing = await findPendienteByDocumento(docenteDoc);
    if (existing) {
      throw ApiError.conflict('Ya hay una llave prestada para este docente');
    }

    const docente = await findDocenteByDocumento(docenteDoc);
    const registro = await persistirPrestamo({
      docente: docente || persona,
      clase,
      seReclamoATiempo: true,
      tiempoRetraso: '',
      reclamaInfo: {
        quien: rol || 'docente',
        documento: documento_persona || docenteDoc,
        nombre: nombre_persona || persona.nombre,
      },
      tipoEntrega: 'manual',
      ubicacionPrestamo,
    });

    return {
      ok: true,
      mensaje: `Llave entregada a ${(docente || persona).nombre}`,
      registro,
      docente: docente || persona,
    };
  }

  async function registrarEntrega(infoClase, formatRegistro) {
    const ubicacionPrestamo = await normalizarUbicacionPrestamo(infoClase.ubicacion);
    const origenRegistro = normalizarOrigenRegistro(infoClase.origen);
    validarEntregaManual(infoClase);

    const documento = normalizarDocumento(infoClase.nroidenti);
    const existing = await findPendienteByDocumento(documento);
    if (existing) {
      throw ApiError.conflict('El docente ya tiene una llave prestada');
    }

    const registro = construirRegistroEntregaManual({
      infoClase,
      documento,
      ubicacionPrestamo,
      origenRegistro,
    });

    const created = await createRegistro(registro);
    return {
      ok: true,
      mensaje: `Llave entregada a ${infoClase.profesor}`,
      registro: formatRegistro(created),
    };
  }

  async function registrarDevolucion(documento, ubicacion) {
    const doc = normalizarDocumento(documento);
    const registro = await findPendienteByDocumento(doc);
    if (!registro) {
      throw ApiError.notFound('No se encontró llave en préstamo para este docente');
    }

    const ubicacionDevolucion = await normalizarUbicacionDevolucion(ubicacion);
    const result = await persistirDevolucion(registro, {
      canal: 'manual',
      ubicacion: ubicacionDevolucion,
    });
    return { ok: true, ...result };
  }

  return {
    procesarLecturaNFC,
    confirmarPrestamoAnticipado,
    registrarEntrega,
    registrarDevolucion,
  };
}

module.exports = {
  createLlaveWorkflows,
};
