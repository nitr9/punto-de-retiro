/*
 * Tipos compartidos por los tres procesos.
 *
 * Los nombres de campo son los mismos que las columnas de SQLite, para que una
 * fila leida de la base sea directamente el objeto que viaja a la pantalla.
 */

export type EstadoPaquete = 'EN_STOCK' | 'ENTREGADO' | 'DEVUELTO' | 'INCIDENCIA'
export type EstadoLote = 'ABIERTO' | 'CERRADO'
export type RolOperador = 'admin' | 'operador'
export type TipoMovimiento = 'INGRESO' | 'ENTREGA' | 'DEVOLUCION' | 'EDICION'

export interface Operador {
  id: number
  nombre: string
  rol: RolOperador
  activo: boolean
  creado_en: string
}

export interface Lote {
  id: number
  fecha: string
  transportista: string | null
  remito: string | null
  cantidad_declarada: number | null
  estado: EstadoLote
  operador_id: number | null
  observaciones: string | null
  cerrado_en: string | null
  /** Nombre del operador que abrio el lote, resuelto por JOIN. */
  operador_nombre: string | null
  /** Cuantos paquetes se cargaron contra este lote. */
  cantidad_escaneada: number
}

export interface Paquete {
  id: number
  codigo_tracking: string
  codigo_retiro: string | null
  destinatario_nombre: string | null
  destinatario_dni: string | null
  destinatario_telefono: string | null
  estado: EstadoPaquete
  ubicacion: string | null
  fecha_ingreso: string
  /**
   * La define Mercado Libre por paquete: se sugiere con el plazo configurado
   * pero se puede pisar al recibir y editar despues.
   */
  fecha_limite: string | null
  fecha_egreso: string | null
  lote_id: number | null
  operador_ingreso_id: number | null
  operador_egreso_id: number | null
  retirado_por_nombre: string | null
  retirado_por_dni: string | null
  observaciones: string | null
}

/** Un paquete con los datos que se resuelven al leerlo, no los que se guardan. */
export interface PaqueteDetallado extends Paquete {
  operador_ingreso_nombre: string | null
  operador_egreso_nombre: string | null
  /** Negativo si ya vencio. `null` si el paquete no tiene fecha limite. */
  dias_restantes: number | null
}

export interface Movimiento {
  id: number
  paquete_id: number
  tipo: TipoMovimiento
  fecha: string
  operador_id: number | null
  detalle: string | null
  operador_nombre: string | null
}

export interface Configuracion {
  dias_plazo_default: number
  dias_aviso_vencimiento: number
  nombre_local: string
  /** El local que apila en el piso en vez de usar estantes lo apaga. */
  usar_ubicaciones: boolean
  ubicaciones: string[]
  /**
   * Segunda carpeta donde se duplica la copia diaria: un pendrive fijo o una
   * carpeta de red. Vacia = solo la copia local. Existe porque la copia
   * automatica vivia en el mismo disco que la base, y un disco roto se las
   * llevaba a las dos.
   */
  carpeta_respaldo: string
}

export type CambiosConfiguracion = Partial<Configuracion>

export interface FiltroPaquetes {
  estado?: EstadoPaquete | 'TODOS'
  texto?: string
  soloVencidos?: boolean
  porVencerEnDias?: number
  /** Fecha de ingreso, en formato YYYY-MM-DD. */
  desde?: string
  hasta?: string
  limite?: number
}

export interface DatosIngreso {
  codigo_tracking: string
  codigo_retiro?: string | null
  destinatario_nombre?: string | null
  destinatario_dni?: string | null
  destinatario_telefono?: string | null
  ubicacion?: string | null
  fecha_limite?: string | null
  lote_id?: number | null
  operador_id?: number | null
  observaciones?: string | null
}

/**
 * El ingreso no lanza excepcion cuando el codigo ya esta en stock: devolver el
 * paquete existente permite que Recepcion muestre donde esta guardado.
 */
export type ResultadoIngreso =
  | { ok: true; paquete: PaqueteDetallado }
  | { ok: false; motivo: 'DUPLICADO'; paquete: PaqueteDetallado }
  | { ok: false; motivo: 'ERROR'; mensaje: string }

export interface DatosEntrega {
  paquete_id: number
  operador_id?: number | null
  /** Si no se aclara, se asume que retiro el destinatario. */
  retirado_por_nombre?: string | null
  retirado_por_dni?: string | null
  observaciones?: string | null
}

export type CambiosPaquete = Partial<
  Pick<
    Paquete,
    | 'codigo_retiro'
    | 'destinatario_nombre'
    | 'destinatario_dni'
    | 'destinatario_telefono'
    | 'ubicacion'
    | 'fecha_limite'
    | 'observaciones'
  >
>

export interface DatosLote {
  transportista?: string | null
  remito?: string | null
  cantidad_declarada?: number | null
  operador_id?: number | null
  observaciones?: string | null
}

export type CambiosLote = Partial<
  Pick<Lote, 'transportista' | 'remito' | 'cantidad_declarada' | 'observaciones'>
>

export type CambiosOperador = Partial<Pick<Operador, 'nombre' | 'rol' | 'activo'>>

export interface ResumenStock {
  en_stock: number
  vencidos: number
  por_vencer: number
  sin_ubicacion: number
  ingresados_hoy: number
  entregados_hoy: number
}

export interface ResumenDia {
  /** YYYY-MM-DD */
  dia: string
  ingresados: number
  entregados: number
}

/**
 * Resultado de una busqueda.
 *
 * Viene con el total real ademas de las filas: la consulta trae como maximo
 * `limite` paquetes, y sin el total la pantalla mostraria una cantidad distinta
 * a la de los contadores de arriba, sin ninguna señal de que falta el resto.
 */
export interface ResultadoBusqueda {
  paquetes: PaqueteDetallado[]
  /** Cuantos coinciden con el filtro, ignorando el limite. */
  total: number
}

/** Para que el dueño pueda ver de un vistazo si las copias se estan haciendo. */
export interface EstadoRespaldo {
  /** Fecha de la ultima copia local, o `null` si todavia no hay ninguna. */
  ultima_copia: string | null
  /** Cuantas copias diarias hay guardadas localmente. */
  copias_locales: number
  carpeta_local: string
  /** Segunda carpeta configurada, o `null` si no se configuro ninguna. */
  carpeta_externa: string | null
  /** `false` si la carpeta externa esta configurada pero hoy no se puede escribir. */
  externa_disponible: boolean
  /** Si la copia de la ultima fecha llego tambien a la carpeta externa. */
  externa_al_dia: boolean
}
