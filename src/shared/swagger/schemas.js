'use strict';

const schemas = {
  // ── Respuestas genéricas ──────────────────────────────────────────────────
  ErrorValidacion: {
    type: 'object',
    properties: {
      ok: { type: 'boolean', example: false },
      message: { type: 'string', example: 'Datos inválidos' },
      errors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            campo: { type: 'string', example: 'nombre' },
            mensaje: { type: 'string', example: 'Campo requerido' },
          },
        },
      },
    },
  },
  ErrorNoAutenticado: {
    type: 'object',
    properties: {
      ok: { type: 'boolean', example: false },
      message: { type: 'string', example: 'Token no proporcionado' },
    },
  },
  ErrorNoAutorizado: {
    type: 'object',
    properties: {
      ok: { type: 'boolean', example: false },
      message: { type: 'string', example: 'Acceso denegado: se requiere rol admin_programacion' },
    },
  },
  ErrorNoEncontrado: {
    type: 'object',
    properties: {
      ok: { type: 'boolean', example: false },
      message: { type: 'string', example: 'Recurso no encontrado' },
    },
  },

  // ── Auth ────────────────────────────────────────────────────────────────────
  LoginRequest: {
    type: 'object',
    required: ['usuario', 'password'],
    properties: {
      usuario: { type: 'string', example: 'admin' },
      password: { type: 'string', example: '123456' },
    },
  },
  LoginResponse: {
    type: 'object',
    properties: {
      ok: { type: 'boolean', example: true },
      message: { type: 'string', example: 'Inicio de sesión exitoso' },
      data: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          refreshToken: { type: 'string' },
          usuario: { $ref: '#/components/schemas/UsuarioResumen' },
        },
      },
    },
  },
  RefreshRequest: {
    type: 'object',
    required: ['refreshToken'],
    properties: {
      refreshToken: { type: 'string' },
    },
  },

  // ── Usuario ─────────────────────────────────────────────────────────────────
  Usuario: {
    type: 'object',
    properties: {
      _id: { type: 'string' },
      usuario: { type: 'string', example: 'admin' },
      nombre: { type: 'string', example: 'Administrador' },
      email: { type: 'string', example: 'admin@email.com' },
      contacto: { type: 'string', example: '3001234567' },
      rol: { type: 'string', enum: ['admin_programacion', 'auxiliar_programacion'] },
      activo: { type: 'boolean', example: true },
      fecha_creacion: { type: 'string', format: 'date-time' },
    },
  },
  UsuarioResumen: {
    type: 'object',
    properties: {
      _id: { type: 'string' },
      usuario: { type: 'string' },
      nombre: { type: 'string' },
      rol: { type: 'string' },
    },
  },
  CrearUsuarioRequest: {
    type: 'object',
    required: ['usuario', 'nombre', 'email', 'password'],
    properties: {
      usuario: { type: 'string', minLength: 3, maxLength: 50 },
      nombre: { type: 'string', minLength: 2 },
      email: { type: 'string', format: 'email' },
      contacto: { type: 'string' },
      password: { type: 'string', minLength: 6 },
      rol: { type: 'string', enum: ['admin_programacion', 'auxiliar_programacion'] },
    },
  },
  ActualizarPerfilRequest: {
    type: 'object',
    properties: {
      nombre: { type: 'string', minLength: 2 },
      email: { type: 'string', format: 'email' },
      contacto: { type: 'string' },
    },
  },
  CambiarContrasenaRequest: {
    type: 'object',
    required: ['passwordActual', 'passwordNueva'],
    properties: {
      passwordActual: { type: 'string' },
      passwordNueva: { type: 'string', minLength: 6 },
    },
  },

  // ── Bloque ──────────────────────────────────────────────────────────────────
  Bloque: {
    type: 'object',
    properties: {
      _id: { type: 'string' },
      nombre_bloque: { type: 'string', example: 'Bloque A' },
      fecha_creacion: { type: 'string', format: 'date-time' },
      fecha_actualizacion: { type: 'string', format: 'date-time' },
    },
  },
  CrearBloqueRequest: {
    type: 'object',
    required: ['nombre_bloque'],
    properties: {
      nombre_bloque: { type: 'string', minLength: 1, example: 'Bloque A' },
    },
  },

  // ── Comunidad ──────────────────────────────────────────────────────────────
  Comunidad: {
    type: 'object',
    properties: {
      _id: { type: 'string' },
      numero_documento: { type: 'string', example: '1234567890' },
      nombre: { type: 'string', example: 'Juan Pérez' },
      tipo: { type: 'string', enum: ['docente', 'estudiante', 'empleado'] },
      facultad: { type: 'string', example: 'Ingeniería' },
      correo: { type: 'string', example: 'juan@email.com' },
      id_carnet: { type: 'string', example: 'ABC123' },
    },
  },
  SyncRequest: {
    type: 'object',
    properties: {
      registro: { $ref: '#/components/schemas/SyncRegistro' },
      registros: {
        type: 'array',
        items: { $ref: '#/components/schemas/SyncRegistro' },
      },
    },
  },
  SyncRegistro: {
    type: 'object',
    required: ['numero_documento', 'nombre', 'tipo'],
    properties: {
      numero_documento: { type: 'string', example: '1234567890' },
      nombre: { type: 'string', example: 'Juan Pérez' },
      tipo: { type: 'string', enum: ['docente', 'estudiante', 'empleado'] },
      facultad: { type: 'string' },
      correo: { type: 'string' },
      id_carnet: { type: 'string' },
    },
  },

  // ── Equipo ──────────────────────────────────────────────────────────────────
  Equipo: {
    type: 'object',
    properties: {
      _id: { type: 'string' },
      nombre: { type: 'string', example: 'Proyector' },
      marca: { type: 'string', example: 'Epson' },
      consecutivo: { type: 'number', example: 1 },
      codigo_inventario: { type: 'string', example: 'INV-001' },
      codigo_barras: { type: 'string' },
      descripcion: { type: 'string' },
      estado: { type: 'string', enum: ['activo', 'inactivo', 'mantenimiento'] },
      fecha_creacion: { type: 'string', format: 'date-time' },
    },
  },
  CrearEquipoRequest: {
    type: 'object',
    required: ['nombre', 'consecutivo', 'codigo_inventario'],
    properties: {
      nombre: { type: 'string', minLength: 1 },
      marca: { type: 'string' },
      consecutivo: { oneOf: [{ type: 'string' }, { type: 'number' }] },
      codigo_inventario: { type: 'string', minLength: 1 },
      descripcion: { type: 'string' },
    },
  },
  ActualizarEquipoRequest: {
    type: 'object',
    properties: {
      nombre: { type: 'string' },
      marca: { type: 'string' },
      consecutivo: { oneOf: [{ type: 'string' }, { type: 'number' }] },
      codigo_inventario: { type: 'string' },
      descripcion: { type: 'string' },
      estado: { type: 'string', enum: ['activo', 'inactivo', 'mantenimiento'] },
    },
  },

  // ── Salón ───────────────────────────────────────────────────────────────────
  Salon: {
    type: 'object',
    properties: {
      _id: { type: 'string' },
      nombre_salon: { type: 'string', example: 'A-101' },
      nombre_bloque: { type: 'string', example: 'Bloque A' },
      capacidad_estudiantes: { type: 'integer', example: 40 },
      tipo_silleteria: { type: 'string', example: 'universitaria' },
      fecha_creacion: { type: 'string', format: 'date-time' },
    },
  },
  CrearSalonRequest: {
    type: 'object',
    required: ['nombre_salon', 'nombre_bloque', 'capacidad_estudiantes', 'tipo_silleteria'],
    properties: {
      nombre_salon: { type: 'string', minLength: 1 },
      nombre_bloque: { type: 'string', minLength: 1 },
      capacidad_estudiantes: { type: 'integer', minimum: 1 },
      tipo_silleteria: { type: 'string', minLength: 1 },
    },
  },

  // ── Ubicación ──────────────────────────────────────────────────────────────
  Ubicacion: {
    type: 'object',
    properties: {
      _id: { type: 'string' },
      clave: { type: 'string', example: 'oficina_centro_servicios_docentes' },
      nombre: { type: 'string', example: 'Oficina Centro de Servicios Docentes' },
      descripcion: { type: 'string' },
      activa: { type: 'boolean', example: true },
      permite_identificacion: { type: 'boolean' },
      permite_prestamo_llaves: { type: 'boolean' },
      permite_devolucion_llaves: { type: 'boolean' },
      permite_prestamo_equipos: { type: 'boolean' },
    },
  },
  CrearUbicacionRequest: {
    type: 'object',
    required: ['clave', 'nombre'],
    properties: {
      clave: { type: 'string', minLength: 2 },
      nombre: { type: 'string', minLength: 2 },
      descripcion: { type: 'string' },
      activa: { type: 'boolean' },
      permite_identificacion: { type: 'boolean' },
      permite_prestamo_llaves: { type: 'boolean' },
      permite_devolucion_llaves: { type: 'boolean' },
      permite_prestamo_equipos: { type: 'boolean' },
    },
  },

  // ── Monitor ─────────────────────────────────────────────────────────────────
  Monitor: {
    type: 'object',
    properties: {
      _id: { type: 'string' },
      numero_documento_docente: { type: 'string' },
      nombre_docente: { type: 'string' },
      numero_documento_monitor: { type: 'string' },
      nombre_monitor: { type: 'string' },
      id_carnet_monitor: { type: 'string' },
      materia: { type: 'string' },
      aula: { type: 'string' },
      horario: { type: 'string' },
      dia: { type: 'string' },
      activo: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  RegistrarMonitorRequest: {
    type: 'object',
    required: ['numero_documento_docente', 'numero_documento_monitor', 'materia'],
    properties: {
      numero_documento_docente: { type: 'string', minLength: 1 },
      numero_documento_monitor: { type: 'string', minLength: 1 },
      materia: { type: 'string', minLength: 1 },
      aula: { type: 'string' },
      horario: { type: 'string' },
      dia: { type: 'string' },
    },
  },

  // ── Llave (Registro) ──────────────────────────────────────────────────────
  Llave: {
    type: 'object',
    properties: {
      _id: { type: 'string' },
      numero_documento: { type: 'string' },
      docente: { type: 'string' },
      dia: { type: 'string' },
      horario: { type: 'string' },
      aula: { type: 'string' },
      facultad: { type: 'string' },
      materia: { type: 'string' },
      fecha_hora_entrega: { type: 'string', format: 'date-time' },
      fecha_hora_devolucion: { type: 'string', format: 'date-time', nullable: true },
      estado: { type: 'string', enum: ['en_prestamo', 'entregado', 'demora_entrega'] },
      tipo_entrega: { type: 'string', enum: ['manual', 'carnet', ''] },
      tipo_devolucion: { type: 'string', enum: ['manual', 'carnet', ''] },
      quien_reclama: { type: 'string', enum: ['docente', 'monitor', ''] },
      quien_entrega: { type: 'string', enum: ['docente', 'monitor', ''] },
      ubicacion_prestamo: { type: 'string' },
      ubicacion_devolucion: { type: 'string' },
    },
  },
  EntregarLlaveRequest: {
    type: 'object',
    required: ['nroidenti', 'profesor', 'aula'],
    properties: {
      nroidenti: { type: 'string', minLength: 1 },
      profesor: { type: 'string', minLength: 1 },
      aula: { type: 'string', minLength: 1 },
      hora_inicio: { type: 'string' },
      hora_fin: { type: 'string' },
      dia: { type: 'string' },
      facultad: { type: 'string' },
      motivo: { type: 'string' },
      ubicacion: { type: 'string' },
      origen: { type: 'string', enum: ['individual', 'programacion'] },
    },
  },
  ProcesarNFCLlaveRequest: {
    type: 'object',
    required: ['id_carnet'],
    properties: {
      id_carnet: { type: 'string', minLength: 1 },
      ubicacion: { type: 'string' },
    },
  },
  ConfirmarAnticipadoRequest: {
    type: 'object',
    required: ['id_carnet', 'horario', 'aula'],
    properties: {
      id_carnet: { type: 'string', minLength: 1 },
      horario: { type: 'string', minLength: 1 },
      aula: { type: 'string', minLength: 1 },
      rol: { type: 'string', enum: ['docente', 'monitor'] },
      documento_persona: { type: 'string' },
      nombre_persona: { type: 'string' },
      ubicacion: { type: 'string' },
    },
  },

  // ── Préstamo de equipos ────────────────────────────────────────────────────
  Prestamo: {
    type: 'object',
    properties: {
      _id: { type: 'string' },
      docente_codigo_nfc: { type: 'string' },
      docente_nombre: { type: 'string' },
      auxiliar_prestamista: { type: 'string' },
      ubicacion_prestamo: { type: 'string' },
      equipos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            equipo_id: { type: 'string' },
            equipo_nombre: { type: 'string' },
            equipo_codigo: { type: 'string' },
            estado_equipo: { type: 'string', enum: ['entregado', 'devuelto'] },
            fecha_entrega: { type: 'string', format: 'date-time' },
            fecha_devolucion: { type: 'string', format: 'date-time', nullable: true },
          },
        },
      },
      estado: { type: 'string', enum: ['activo', 'parcialmente_devuelto', 'completamente_devuelto'] },
      fecha_prestamo: { type: 'string', format: 'date-time' },
    },
  },
  CrearPrestamoRequest: {
    type: 'object',
    required: ['docente_codigo_nfc', 'docente_nombre', 'equipos'],
    properties: {
      docente_codigo_nfc: { type: 'string', minLength: 1 },
      docente_nombre: { type: 'string', minLength: 1 },
      equipos: {
        type: 'array',
        items: { oneOf: [{ type: 'string' }, { type: 'object' }] },
        minItems: 1,
      },
      auxiliar_prestamista: { type: 'string' },
      ubicacion_prestamo: { type: 'string' },
    },
  },
  DevolucionRequest: {
    type: 'object',
    required: ['prestamo_id'],
    properties: {
      prestamo_id: { type: 'string', minLength: 1 },
      docente_codigo_nfc: { type: 'string' },
      docente_nombre: { type: 'string' },
      equipos: { type: 'array', items: { type: 'object' } },
      auxiliar_que_recibio: { type: 'string' },
      ubicacion_devolucion: { type: 'string' },
    },
  },

  // ── Programación ──────────────────────────────────────────────────────────
  Programacion: {
    type: 'object',
    properties: {
      _id: { type: 'string' },
      semestre: { type: 'string' },
      numero_documento: { type: 'string' },
      docente: { type: 'string' },
      dia: { type: 'string' },
      horario: { type: 'string' },
      hora_inicio: { type: 'string' },
      hora_fin: { type: 'string' },
      aula: { type: 'string' },
      facultad: { type: 'string' },
      materia: { type: 'string' },
      codigo_materia: { type: 'string' },
      grupo: { type: 'string' },
    },
  },

  // ── NFC ────────────────────────────────────────────────────────────────────
  NFCEvento: {
    type: 'object',
    properties: {
      _id: { type: 'string' },
      evento_id: { type: 'string' },
      id_carnet: { type: 'string' },
      ubicacion: { type: 'string' },
      ok: { type: 'boolean' },
      tipo_resultado: { type: 'string' },
      mensaje_resultado: { type: 'string' },
      procesado_en: { type: 'string', format: 'date-time' },
    },
  },
  LecturaNFCRequest: {
    type: 'object',
    required: ['id_carnet'],
    properties: {
      id_carnet: { type: 'string', minLength: 1 },
      ubicacion: { type: 'string' },
      evento_id: { type: 'string', minLength: 1, maxLength: 120 },
    },
  },

  // ── Notificaciones ─────────────────────────────────────────────────────────
  Notificacion: {
    type: 'object',
    properties: {
      _id: { type: 'string' },
      destinatario_nombre: { type: 'string' },
      destinatario_documento: { type: 'string' },
      destinatario_correo: { type: 'string' },
      tipo_mensaje: { type: 'string', enum: ['predeterminado', 'personalizado'] },
      asunto: { type: 'string' },
      estado_envio: { type: 'string', enum: ['enviado', 'fallido'] },
      fecha_envio: { type: 'string', format: 'date-time' },
    },
  },
  EnviarNotificacionRequest: {
    type: 'object',
    required: ['destinatarios', 'tipo_mensaje'],
    properties: {
      destinatarios: {
        type: 'array',
        items: {
          type: 'object',
          required: ['nombre', 'documento', 'correo', 'fecha_prestamo'],
          properties: {
            nombre: { type: 'string', minLength: 1 },
            documento: { type: 'string', minLength: 1 },
            correo: { type: 'string', format: 'email' },
            salon: { type: 'string' },
            fecha_prestamo: { type: 'string' },
            llave_id: { type: 'string' },
          },
        },
      },
      tipo_mensaje: { type: 'string', enum: ['predeterminado', 'personalizado'] },
      mensaje_personalizado: { type: 'string' },
      asunto: { type: 'string' },
    },
  },
};

module.exports = { schemas };
