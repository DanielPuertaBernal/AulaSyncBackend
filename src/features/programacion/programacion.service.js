'use strict';
const programacionRepository = require('./programacion.repository');
const { parseExcel, cleanText, cleanDocumento, generateExcel } = require('../../shared/utils/excel.parser');
const { getDiaActual, horaAMinutos } = require('../../shared/utils/date.helper');

class ProgramacionService {
  async listar() {
    return programacionRepository.findAll();
  }

  async listarPorDia(dia, clasesConLlave = []) {
    const diaFiltro = dia || getDiaActual();
    const clases = await programacionRepository.findByDia(diaFiltro);

    return clases.filter((clase) => {
      const doc = String(clase.numero_documento).replace('.0', '');
      const horario = String(clase.horario || '').trim();
      const yaEntregada = clasesConLlave.some(
        (c) => String(c.documento).replace('.0', '') === doc && String(c.horario).trim() === horario
      );
      return !yaEntregada;
    });
  }

  async exportar() {
    const registros = await programacionRepository.findAll();
    return generateExcel(registros, 'Programacion');
  }

  async importarDesdeExcel(buffer) {
    const rows = parseExcel(buffer);
    if (!rows.length) throw Object.assign(new Error('El archivo Excel está vacío'), { statusCode: 400 });

    const limpios = this._limpiarProgramacion(rows);
    if (!limpios.length) {
      throw Object.assign(new Error('No se encontraron registros válidos en el archivo'), { statusCode: 400 });
    }

    return programacionRepository.bulkInsert(limpios);
  }

  _limpiarProgramacion(rows) {
    const MAPEO = {
      'nroidenti': 'numero_documento',
      'Número de Documento': 'numero_documento',
      'profesor': 'docente',
      'Docente': 'docente',
      'dia': 'dia',
      'Día': 'dia',
      'horario': 'horario',
      'Horario': 'horario',
      'hora_ini': 'hora_inicio',
      'Hora Inicio': 'hora_inicio',
      'hora_fin': 'hora_fin',
      'Hora Fin': 'hora_fin',
      'aula': 'aula',
      'Aula': 'aula',
      'descripcion': 'facultad',
      'Facultad': 'facultad',
      'descripcion_1': 'materia',
      'Materia de la Clase': 'materia',
      'Código de la Materia': 'codigo_materia',
      'materia': 'codigo_materia',
      'grupo': 'grupo',
      'Grupo': 'grupo',
      'nivel_grupo': 'nivel_grupo',
      'Nivel del Grupo': 'nivel_grupo',
      'nro_estudiantes_premat': 'estudiantes_prematriculados',
      'nro_estudiantes': 'estudiantes_matriculados',
      'total_estudiantes': 'total_estudiantes',
    };

    return rows
      .map((row) => {
        const mapped = {};
        for (const [src, dest] of Object.entries(MAPEO)) {
          if (row[src] !== undefined && row[src] !== null) {
            mapped[dest] = row[src];
          }
        }

        const documento = cleanDocumento(mapped.numero_documento || '');
        if (!documento) return null;
        mapped.numero_documento = documento;

        ['docente', 'dia', 'aula', 'facultad', 'materia', 'horario'].forEach((k) => {
          if (mapped[k]) mapped[k] = cleanText(mapped[k]);
        });

        if (!mapped.horario && mapped.hora_inicio && mapped.hora_fin) {
          mapped.horario = `${mapped.hora_inicio} A ${mapped.hora_fin}`;
        }

        if (mapped.horario && (!mapped.hora_inicio || !mapped.hora_fin)) {
          const [ini, fin] = String(mapped.horario).toUpperCase().split(' A ');
          if (ini) mapped.hora_inicio = ini.trim();
          if (fin) mapped.hora_fin = fin.trim();
        }

        mapped.hora_inicio = this._normalizarMinutos(mapped.hora_inicio);
        mapped.hora_fin = this._normalizarMinutos(mapped.hora_fin);

        mapped.estudiantes_prematriculados = parseInt(mapped.estudiantes_prematriculados, 10) || 0;
        mapped.estudiantes_matriculados = parseInt(mapped.estudiantes_matriculados, 10) || 0;
        mapped.total_estudiantes =
          (mapped.estudiantes_prematriculados + mapped.estudiantes_matriculados) || 0;

        return mapped;
      })
      .filter(Boolean)
      .filter((r) => this._esRegistroValido(r));
  }

  _normalizarMinutos(hora) {
    if (!hora) return hora;
    const parts = String(hora).split(':');
    if (parts.length < 2) return hora;
    const min = parseInt(parts[1], 10);
    if (min >= 1 && min <= 9) {
      return `${parts[0].padStart(2, '0')}:00`;
    }
    return hora;
  }

  _esRegistroValido(r) {
    return !!(r.numero_documento && r.docente && r.dia && r.aula);
  }
}

module.exports = new ProgramacionService();
