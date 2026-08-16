/*
 * Lotes: cada llegada de mercaderia.
 *
 * En el local puede entrar mercaderia mas de una vez en el mismo dia, asi que
 * el lote es la unidad de "esta tanda", no "este dia".
 */

import { db } from './index'
import { ahora, hoy } from '@shared/fechas'
import type { CambiosLote, DatosLote, Lote } from '@shared/types'

const SELECT_CON_TOTALES = `
  SELECT l.*,
         o.nombre AS operador_nombre,
         (SELECT COUNT(*) FROM paquetes p WHERE p.lote_id = l.id) AS cantidad_escaneada
  FROM lotes l
  LEFT JOIN operadores o ON o.id = l.operador_id
`

export function obtenerLote(id: number): Lote | null {
  const fila = db().prepare(`${SELECT_CON_TOTALES} WHERE l.id = ?`).get(id) as Lote | undefined
  return fila ?? null
}

export function loteAbierto(): Lote | null {
  const fila = db()
    .prepare(`${SELECT_CON_TOTALES} WHERE l.estado = 'ABIERTO' ORDER BY l.id DESC LIMIT 1`)
    .get() as Lote | undefined
  return fila ?? null
}

/**
 * Solo puede haber un lote abierto a la vez: si ya hay uno, se sigue usando ese.
 * Asi el operador que vuelve a Recepcion despues de atender el mostrador no
 * arranca una tanda nueva sin darse cuenta.
 */
export function crearLote(datos: DatosLote): Lote | null {
  const abierto = loteAbierto()
  if (abierto) return abierto

  const resultado = db()
    .prepare(
      `INSERT INTO lotes (fecha, transportista, remito, cantidad_declarada, estado, operador_id, observaciones)
       VALUES (?, ?, ?, ?, 'ABIERTO', ?, ?)`
    )
    .run(
      hoy(),
      datos.transportista?.trim() || null,
      datos.remito?.trim() || null,
      datos.cantidad_declarada ?? null,
      datos.operador_id ?? null,
      datos.observaciones?.trim() || null
    )

  return obtenerLote(Number(resultado.lastInsertRowid))
}

export function actualizarLote(id: number, cambios: CambiosLote): Lote | null {
  const actual = obtenerLote(id)
  if (!actual) return null

  db()
    .prepare(
      `UPDATE lotes SET transportista = ?, remito = ?, cantidad_declarada = ?, observaciones = ?
       WHERE id = ?`
    )
    .run(
      cambios.transportista !== undefined
        ? cambios.transportista?.trim() || null
        : actual.transportista,
      cambios.remito !== undefined ? cambios.remito?.trim() || null : actual.remito,
      cambios.cantidad_declarada !== undefined
        ? cambios.cantidad_declarada
        : actual.cantidad_declarada,
      cambios.observaciones !== undefined
        ? cambios.observaciones?.trim() || null
        : actual.observaciones,
      id
    )

  return obtenerLote(id)
}

export function cerrarLote(id: number): Lote | null {
  const lote = obtenerLote(id)
  if (!lote) return null
  if (lote.estado === 'CERRADO') return lote

  db().prepare(`UPDATE lotes SET estado = 'CERRADO', cerrado_en = ? WHERE id = ?`).run(ahora(), id)
  return obtenerLote(id)
}

export function listarLotes(limite = 50): Lote[] {
  return db().prepare(`${SELECT_CON_TOTALES} ORDER BY l.id DESC LIMIT ?`).all(limite) as Lote[]
}
