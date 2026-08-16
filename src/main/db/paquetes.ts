/*
 * Paquetes: el nucleo de la aplicacion.
 *
 * Toda salida de stock (entrega o devolucion) deja ademas una fila en
 * `movimientos`, que no se modifica ni se borra nunca. Es lo que permite
 * responder un reclamo: quien recibio, quien entrego y cuando.
 */

import { db } from './index'
import { obtenerConfiguracion } from './configuracion'
import { ahora, diasEntre, hoy, sumarDias } from '@shared/fechas'
import type {
  CambiosPaquete,
  DatosEntrega,
  DatosIngreso,
  FiltroPaquetes,
  Movimiento,
  Paquete,
  PaqueteDetallado,
  ResultadoBusqueda,
  ResultadoIngreso,
  ResumenDia,
  ResumenStock,
  TipoMovimiento
} from '@shared/types'

const LIMITE_POR_DEFECTO = 500

const SELECT_BASE = `
  SELECT p.*,
         oi.nombre AS operador_ingreso_nombre,
         oe.nombre AS operador_egreso_nombre
  FROM paquetes p
  LEFT JOIN operadores oi ON oi.id = p.operador_ingreso_id
  LEFT JOIN operadores oe ON oe.id = p.operador_egreso_id
`

type FilaPaquete = Paquete & {
  operador_ingreso_nombre: string | null
  operador_egreso_nombre: string | null
}

/** Los codigos se guardan en mayusculas: el lector de codigos no siempre respeta el caso. */
function normalizarCodigo(codigo: string | null | undefined): string | null {
  if (!codigo) return null
  const limpio = codigo.trim().toUpperCase()
  return limpio || null
}

/** Un campo vacio se guarda como NULL, no como cadena vacia. */
function limpiarTexto(texto: string | null | undefined): string | null {
  if (texto === null || texto === undefined) return null
  const limpio = texto.trim()
  return limpio || null
}

function aDetallado(fila: FilaPaquete): PaqueteDetallado {
  return {
    ...fila,
    dias_restantes: fila.fecha_limite ? diasEntre(hoy(), fila.fecha_limite) : null
  }
}

function registrarMovimiento(
  paqueteId: number,
  tipo: TipoMovimiento,
  operadorId: number | null,
  detalle: string | null
): void {
  db()
    .prepare(
      'INSERT INTO movimientos (paquete_id, tipo, fecha, operador_id, detalle) VALUES (?, ?, ?, ?, ?)'
    )
    .run(paqueteId, tipo, ahora(), operadorId, detalle)
}

export function obtenerPaquete(id: number): PaqueteDetallado | null {
  const fila = db().prepare(`${SELECT_BASE} WHERE p.id = ?`).get(id) as FilaPaquete | undefined
  return fila ? aDetallado(fila) : null
}

/**
 * Busca por codigo de seguimiento o de retiro. Si el codigo aparece varias veces
 * en el historial, prioriza el que esta en stock: es el que se viene a retirar.
 */
export function buscarPorCodigo(codigo: string): PaqueteDetallado | null {
  const normalizado = normalizarCodigo(codigo)
  if (!normalizado) return null

  const fila = db()
    .prepare(
      `${SELECT_BASE}
       WHERE (p.codigo_tracking = ? OR p.codigo_retiro = ?)
       ORDER BY CASE WHEN p.estado = 'EN_STOCK' THEN 0 ELSE 1 END, p.fecha_ingreso DESC
       LIMIT 1`
    )
    .get(normalizado, normalizado) as FilaPaquete | undefined

  return fila ? aDetallado(fila) : null
}

/**
 * No lanza excepcion ante un duplicado: devuelve el paquete que ya estaba en
 * stock para que Recepcion pueda mostrar donde esta guardado, sin cortar el
 * escaneo continuo.
 */
export function registrarIngreso(datos: DatosIngreso): ResultadoIngreso {
  const tracking = normalizarCodigo(datos.codigo_tracking)
  if (!tracking) {
    return { ok: false, motivo: 'ERROR', mensaje: 'Falta el código de seguimiento del paquete.' }
  }

  const existente = db()
    .prepare(`${SELECT_BASE} WHERE p.codigo_tracking = ? AND p.estado = 'EN_STOCK'`)
    .get(tracking) as FilaPaquete | undefined

  if (existente) {
    return { ok: false, motivo: 'DUPLICADO', paquete: aDetallado(existente) }
  }

  const config = obtenerConfiguracion()
  const fechaLimite =
    limpiarTexto(datos.fecha_limite) ?? sumarDias(hoy(), config.dias_plazo_default)

  try {
    const resultado = db()
      .prepare(
        `INSERT INTO paquetes (
           codigo_tracking, codigo_retiro, destinatario_nombre, destinatario_dni,
           destinatario_telefono, estado, ubicacion, fecha_ingreso, fecha_limite,
           lote_id, operador_ingreso_id, observaciones
         ) VALUES (?, ?, ?, ?, ?, 'EN_STOCK', ?, ?, ?, ?, ?, ?)`
      )
      .run(
        tracking,
        normalizarCodigo(datos.codigo_retiro),
        limpiarTexto(datos.destinatario_nombre),
        limpiarTexto(datos.destinatario_dni),
        limpiarTexto(datos.destinatario_telefono),
        limpiarTexto(datos.ubicacion),
        ahora(),
        fechaLimite,
        datos.lote_id ?? null,
        datos.operador_id ?? null,
        limpiarTexto(datos.observaciones)
      )

    const id = Number(resultado.lastInsertRowid)
    registrarMovimiento(id, 'INGRESO', datos.operador_id ?? null, `Ingreso de ${tracking}`)
    return { ok: true, paquete: obtenerPaquete(id) as PaqueteDetallado }
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido'
    return { ok: false, motivo: 'ERROR', mensaje }
  }
}

/**
 * Devuelve las filas y el total real.
 *
 * El total sale de un `COUNT(*)` con el mismo `WHERE` pero sin el `LIMIT`: la
 * pantalla necesita saber cuantos hay de verdad para poder avisar que la lista
 * esta cortada, y no mostrar una cantidad que no coincide con los contadores.
 */
export function buscar(filtro: FiltroPaquetes = {}): ResultadoBusqueda {
  const condiciones: string[] = []
  const parametros: unknown[] = []

  if (filtro.estado && filtro.estado !== 'TODOS') {
    condiciones.push('p.estado = ?')
    parametros.push(filtro.estado)
  }

  const texto = filtro.texto?.trim()
  if (texto) {
    const patron = `%${texto}%`
    const patronCodigo = `%${texto.toUpperCase()}%`
    condiciones.push(`(
      p.codigo_tracking LIKE ?
      OR p.codigo_retiro LIKE ?
      OR p.destinatario_nombre LIKE ?
      OR p.destinatario_dni LIKE ?
      OR p.destinatario_telefono LIKE ?
      OR p.ubicacion LIKE ?
    )`)
    parametros.push(patronCodigo, patronCodigo, patron, patron, patron, patron)
  }

  if (filtro.soloVencidos) {
    condiciones.push('p.fecha_limite IS NOT NULL AND p.fecha_limite < ?')
    parametros.push(hoy())
  }

  if (filtro.porVencerEnDias !== undefined) {
    condiciones.push('p.fecha_limite IS NOT NULL AND p.fecha_limite BETWEEN ? AND ?')
    parametros.push(hoy(), sumarDias(hoy(), filtro.porVencerEnDias))
  }

  // `substr` sobre la fecha compara solo la parte del dia, ignorando la hora.
  if (filtro.desde) {
    condiciones.push('substr(p.fecha_ingreso, 1, 10) >= ?')
    parametros.push(filtro.desde)
  }
  if (filtro.hasta) {
    condiciones.push('substr(p.fecha_ingreso, 1, 10) <= ?')
    parametros.push(filtro.hasta)
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''

  // En stock ordena por lo que vence primero, que es lo que hay que mirar.
  // El historial ordena por lo ultimo que salio.
  const orden =
    filtro.estado === 'ENTREGADO' || filtro.estado === 'DEVUELTO'
      ? 'ORDER BY p.fecha_egreso DESC'
      : `ORDER BY CASE WHEN p.estado = 'EN_STOCK' THEN 0 ELSE 1 END,
                  COALESCE(p.fecha_limite, '9999-12-31') ASC,
                  p.fecha_ingreso ASC`

  const limite = filtro.limite ?? LIMITE_POR_DEFECTO
  const filas = db()
    .prepare(`${SELECT_BASE} ${where} ${orden} LIMIT ?`)
    .all(...parametros, limite) as FilaPaquete[]

  // Si la consulta no llego al tope, el total ya lo sabemos y nos ahorramos el
  // COUNT: es el caso normal, con el local muy por debajo de los 500.
  const total =
    filas.length < limite
      ? filas.length
      : (db().prepare(`SELECT COUNT(*) AS total FROM paquetes p ${where}`).get(...parametros) as {
          total: number
        }).total

  return { paquetes: filas.map(aDetallado), total }
}

export function entregar(datos: DatosEntrega): PaqueteDetallado | null {
  const paquete = obtenerPaquete(datos.paquete_id)
  if (!paquete) throw new Error('El paquete no existe.')

  if (paquete.estado !== 'EN_STOCK') {
    throw new Error(
      paquete.estado === 'ENTREGADO'
        ? 'Este paquete ya fue entregado.'
        : 'Este paquete ya no está en stock.'
    )
  }

  // Si no se aclara quien vino a retirar, se asume el destinatario: es el caso
  // normal, y pedirlo en cada entrega agregaria un paso al mostrador.
  const quienRetira = limpiarTexto(datos.retirado_por_nombre) ?? paquete.destinatario_nombre

  const aplicar = db().transaction(() => {
    db()
      .prepare(
        `UPDATE paquetes
         SET estado = 'ENTREGADO', fecha_egreso = ?, operador_egreso_id = ?,
             retirado_por_nombre = ?, retirado_por_dni = ?
         WHERE id = ?`
      )
      .run(
        ahora(),
        datos.operador_id ?? null,
        quienRetira,
        limpiarTexto(datos.retirado_por_dni),
        datos.paquete_id
      )

    const detalle = limpiarTexto(datos.observaciones)
    const quien = quienRetira ? `Retiró ${quienRetira}` : 'Entregado sin registrar quién retiró'
    registrarMovimiento(
      datos.paquete_id,
      'ENTREGA',
      datos.operador_id ?? null,
      detalle ? `${quien}. ${detalle}` : quien
    )
  })

  aplicar()
  return obtenerPaquete(datos.paquete_id)
}

/**
 * Devolucion masiva a Mercado Libre. Devuelve cuantos se dieron de baja: el
 * `WHERE ... AND estado = 'EN_STOCK'` ignora los que ya habian salido, asi que
 * el numero puede ser menor que la cantidad de ids.
 */
export function marcarDevueltos(
  ids: number[],
  operadorId: number | null,
  motivo?: string
): number {
  if (!ids.length) return 0

  const actualizar = db().prepare(
    `UPDATE paquetes SET estado = 'DEVUELTO', fecha_egreso = ?, operador_egreso_id = ?
     WHERE id = ? AND estado = 'EN_STOCK'`
  )

  let devueltos = 0
  const aplicar = db().transaction(() => {
    for (const id of ids) {
      const r = actualizar.run(ahora(), operadorId, id)
      if (r.changes > 0) {
        devueltos++
        registrarMovimiento(id, 'DEVOLUCION', operadorId, motivo?.trim() || 'Devuelto a Mercado Libre')
      }
    }
  })

  aplicar()
  return devueltos
}

const ETIQUETAS: Record<keyof CambiosPaquete, string> = {
  codigo_retiro: 'código de retiro',
  destinatario_nombre: 'destinatario',
  destinatario_dni: 'DNI',
  destinatario_telefono: 'teléfono',
  ubicacion: 'ubicación',
  fecha_limite: 'fecha límite',
  observaciones: 'observaciones'
}

/**
 * Edita la ficha y anota en la bitacora que cambio de que a que, en castellano.
 * Un "se edito el paquete" a secas no sirve para responder un reclamo.
 */
export function actualizarPaquete(
  id: number,
  cambios: CambiosPaquete,
  operadorId: number | null = null
): PaqueteDetallado | null {
  const actual = obtenerPaquete(id)
  if (!actual) return null

  const columnas: string[] = []
  const valores: unknown[] = []
  const descripcion: string[] = []

  for (const [clave, valor] of Object.entries(cambios) as [
    keyof CambiosPaquete,
    string | null | undefined
  ][]) {
    // El nombre de la columna se interpola en el SQL, asi que solo se aceptan
    // las claves conocidas. Hoy la interfaz nunca manda otra cosa; esto es para
    // que siga siendo cierto cuando alguien agregue un campo mas adelante.
    if (!Object.prototype.hasOwnProperty.call(ETIQUETAS, clave)) continue

    const nuevo = clave === 'codigo_retiro' ? normalizarCodigo(valor) : limpiarTexto(valor)
    if (nuevo === actual[clave]) continue

    columnas.push(`${clave} = ?`)
    valores.push(nuevo)
    descripcion.push(`${ETIQUETAS[clave]}: "${actual[clave] ?? '—'}" → "${nuevo ?? '—'}"`)
  }

  if (!columnas.length) return actual

  const aplicar = db().transaction(() => {
    db()
      .prepare(`UPDATE paquetes SET ${columnas.join(', ')} WHERE id = ?`)
      .run(...valores, id)
    registrarMovimiento(id, 'EDICION', operadorId, descripcion.join(' | '))
  })

  aplicar()
  return obtenerPaquete(id)
}

export function resumenStock(): ResumenStock {
  const config = obtenerConfiguracion()
  const fechaHoy = hoy()
  const limiteAviso = sumarDias(fechaHoy, config.dias_aviso_vencimiento)

  const contar = (sql: string, ...params: unknown[]): number => {
    const fila = db().prepare(sql).get(...params) as { total: number }
    return fila.total
  }

  return {
    en_stock: contar(`SELECT COUNT(*) AS total FROM paquetes WHERE estado = 'EN_STOCK'`),
    vencidos: contar(
      `SELECT COUNT(*) AS total FROM paquetes
       WHERE estado = 'EN_STOCK' AND fecha_limite IS NOT NULL AND fecha_limite < ?`,
      fechaHoy
    ),
    por_vencer: contar(
      `SELECT COUNT(*) AS total FROM paquetes
       WHERE estado = 'EN_STOCK' AND fecha_limite IS NOT NULL AND fecha_limite BETWEEN ? AND ?`,
      fechaHoy,
      limiteAviso
    ),
    sin_ubicacion: contar(
      `SELECT COUNT(*) AS total FROM paquetes
       WHERE estado = 'EN_STOCK' AND (ubicacion IS NULL OR ubicacion = '')`
    ),
    ingresados_hoy: contar(
      `SELECT COUNT(*) AS total FROM paquetes WHERE substr(fecha_ingreso, 1, 10) = ?`,
      fechaHoy
    ),
    entregados_hoy: contar(
      `SELECT COUNT(*) AS total FROM paquetes
       WHERE estado = 'ENTREGADO' AND substr(fecha_egreso, 1, 10) = ?`,
      fechaHoy
    )
  }
}

/** Alimenta el calendario mensual: cuantos entraron y salieron cada dia. */
export function resumenPorDia(desde: string, hasta: string): ResumenDia[] {
  const ingresos = db()
    .prepare(
      `SELECT substr(fecha_ingreso, 1, 10) AS dia, COUNT(*) AS total
       FROM paquetes
       WHERE substr(fecha_ingreso, 1, 10) BETWEEN ? AND ?
       GROUP BY dia`
    )
    .all(desde, hasta) as { dia: string; total: number }[]

  const egresos = db()
    .prepare(
      `SELECT substr(fecha_egreso, 1, 10) AS dia, COUNT(*) AS total
       FROM paquetes
       WHERE estado = 'ENTREGADO' AND fecha_egreso IS NOT NULL
         AND substr(fecha_egreso, 1, 10) BETWEEN ? AND ?
       GROUP BY dia`
    )
    .all(desde, hasta) as { dia: string; total: number }[]

  const porDia = new Map<string, ResumenDia>()

  for (const { dia, total } of ingresos) {
    porDia.set(dia, { dia, ingresados: total, entregados: 0 })
  }
  for (const { dia, total } of egresos) {
    const actual = porDia.get(dia)
    if (actual) actual.entregados = total
    else porDia.set(dia, { dia, ingresados: 0, entregados: total })
  }

  return [...porDia.values()].sort((a, b) => a.dia.localeCompare(b.dia))
}

export function listarMovimientos(paqueteId: number): Movimiento[] {
  return db()
    .prepare(
      `SELECT m.id, m.paquete_id, m.tipo, m.fecha, m.operador_id, m.detalle,
              o.nombre AS operador_nombre
       FROM movimientos m
       LEFT JOIN operadores o ON o.id = m.operador_id
       WHERE m.paquete_id = ?
       ORDER BY m.fecha DESC, m.id DESC`
    )
    .all(paqueteId) as Movimiento[]
}
