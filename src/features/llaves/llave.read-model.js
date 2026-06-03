'use strict';

const llaveRepository = require('./llave.repository');
const programacionRepository = require('../programacion/programacion.repository');
const {
  normalizeString,
  normalizeHorario,
  normalizeAula,
} = require('../../shared/utils/normalize.helper');
const { normalizarDocumento } = require('./llave.domain');

function aplicarFiltroEstado(items = [], estado) {
  if (!estado) return items;
  return items.filter((item) => item.estado === estado);
}

async function obtenerHistorialFormateado(filters = {}, pagination = null, toClientFormat = (item) => item) {
  const repositoryFilters = { ...filters };
  if (repositoryFilters.estado) {
    delete repositoryFilters.estado;
  }

  if (pagination && filters.estado) {
    const fullResult = await llaveRepository.findHistorial(repositoryFilters, null);
    const source = fullResult.data || fullResult;
    const transformed = aplicarFiltroEstado(
      source.map((registro) => toClientFormat(registro)),
      filters.estado,
    );
    const { page, limit } = pagination;
    const start = (page - 1) * limit;
    const data = transformed.slice(start, start + limit);

    return {
      data,
      meta: {
        page,
        limit,
        total: transformed.length,
        totalPages: Math.ceil(transformed.length / limit),
      },
    };
  }

  const result = await llaveRepository.findHistorial(repositoryFilters, pagination);

  if (pagination) {
    return {
      data: result.data.map((registro) => toClientFormat(registro)),
      meta: result.meta,
    };
  }

  return aplicarFiltroEstado(
    (result.data || result).map((registro) => toClientFormat(registro)),
    filters.estado,
  );
}

async function formatearPendientes(raw = [], toClientFormat = (item) => item) {
  const individuales = await filtrarPrestamosIndividuales(raw);
  return individuales.map((registro) => toClientFormat(registro));
}

function esPrestamoIndividual(registro) {
  return registro?.origen_registro === 'individual';
}

async function filtrarPrestamosIndividuales(registros = []) {
  const cacheProgramacionPorDia = new Map();
  const resultado = [];

  for (const registro of registros) {
    if (!esPrestamoIndividual(registro)) continue;

    const esProgramacion = await coincideConProgramacion(registro, cacheProgramacionPorDia);
    if (esProgramacion) {
      try {
        await llaveRepository.update(registro._id, { origen_registro: 'programacion' });
      } catch (_) {
        // Ignorar autocorrección fallida sin romper la consulta
      }
      continue;
    }

    resultado.push(registro);
  }

  return resultado;
}

async function coincideConProgramacion(registro, cacheProgramacionPorDia) {
  const dia = normalizeString(registro?.dia);
  const horario = normalizeHorario(registro?.horario);
  const aula = normalizeAula(registro?.aula);
  const documento = normalizarDocumento(registro?.numero_documento);

  if (!dia || !horario || !aula || !documento) return false;

  if (!cacheProgramacionPorDia.has(dia)) {
    const clasesDia = await programacionRepository.findByDia(dia);
    cacheProgramacionPorDia.set(dia, clasesDia || []);
  }

  const clases = cacheProgramacionPorDia.get(dia) || [];
  return clases.some((clase) => (
    normalizarDocumento(clase.numero_documento) === documento
    && normalizeHorario(clase.horario) === horario
    && normalizeAula(clase.aula) === aula
  ));
}

module.exports = {
  obtenerHistorialFormateado,
  formatearPendientes,
};
