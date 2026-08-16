/*
 * Operadores: quien recibe y quien entrega.
 *
 * No se borran, se desactivan: sus nombres siguen colgando de paquetes y
 * movimientos viejos, y la bitacora tiene que seguir siendo legible.
 */

import { db } from './index'
import { ahora } from '@shared/fechas'
import type { CambiosOperador, Operador, RolOperador } from '@shared/types'

type FilaOperador = Omit<Operador, 'activo'> & { activo: number }

function aOperador(fila: FilaOperador): Operador {
  return { ...fila, activo: fila.activo === 1 }
}

export function listarOperadores(soloActivos = false): Operador[] {
  const sql = soloActivos
    ? 'SELECT id, nombre, rol, activo, creado_en FROM operadores WHERE activo = 1 ORDER BY nombre'
    : 'SELECT id, nombre, rol, activo, creado_en FROM operadores ORDER BY activo DESC, nombre'
  return (db().prepare(sql).all() as FilaOperador[]).map(aOperador)
}

export function obtenerOperador(id: number): Operador | null {
  const fila = db()
    .prepare('SELECT id, nombre, rol, activo, creado_en FROM operadores WHERE id = ?')
    .get(id) as FilaOperador | undefined
  return fila ? aOperador(fila) : null
}

export function crearOperador(nombre: string, rol: RolOperador = 'operador'): Operador | null {
  const limpio = nombre.trim()
  if (!limpio) throw new Error('El nombre del operador no puede estar vacío.')

  const resultado = db()
    .prepare('INSERT INTO operadores (nombre, rol, activo, creado_en) VALUES (?, ?, 1, ?)')
    .run(limpio, rol, ahora())

  return obtenerOperador(Number(resultado.lastInsertRowid))
}

export function actualizarOperador(id: number, cambios: CambiosOperador): Operador | null {
  const actual = obtenerOperador(id)
  if (!actual) return null

  const nombre = cambios.nombre?.trim() || actual.nombre
  const rol = cambios.rol ?? actual.rol
  const activo = cambios.activo === undefined ? actual.activo : cambios.activo

  db()
    .prepare('UPDATE operadores SET nombre = ?, rol = ?, activo = ? WHERE id = ?')
    .run(nombre, rol, activo ? 1 : 0, id)

  return obtenerOperador(id)
}
