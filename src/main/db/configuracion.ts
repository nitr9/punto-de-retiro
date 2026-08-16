/*
 * Configuracion.
 *
 * Se guarda como pares clave/valor de texto para no migrar el esquema cada vez
 * que se agrega una opcion. La conversion a tipos reales pasa toda por aca.
 */

import { db } from './index'
import type { CambiosConfiguracion, Configuracion } from '@shared/types'

function leerTodo(): Record<string, string> {
  const filas = db().prepare('SELECT clave, valor FROM configuracion').all() as {
    clave: string
    valor: string
  }[]
  return Object.fromEntries(filas.map((f) => [f.clave, f.valor]))
}

function aEnteroPositivo(valor: string | undefined, porDefecto: number): number {
  const n = Number.parseInt(valor ?? '', 10)
  return Number.isFinite(n) && n >= 0 ? n : porDefecto
}

function aListaDeTextos(valor: string | undefined): string[] {
  if (!valor) return []
  try {
    const parsed = JSON.parse(valor)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function obtenerConfiguracion(): Configuracion {
  const bruto = leerTodo()
  return {
    dias_plazo_default: aEnteroPositivo(bruto.dias_plazo_default, 3),
    dias_aviso_vencimiento: aEnteroPositivo(bruto.dias_aviso_vencimiento, 1),
    nombre_local: bruto.nombre_local || 'Punto de Retiro',
    // Cualquier valor distinto de "0" cuenta como encendido: una base vieja sin
    // la clave sigue mostrando las ubicaciones, que es como venia funcionando.
    usar_ubicaciones: bruto.usar_ubicaciones !== '0',
    ubicaciones: aListaDeTextos(bruto.ubicaciones),
    carpeta_respaldo: bruto.carpeta_respaldo ?? ''
  }
}

export function guardarConfiguracion(cambios: CambiosConfiguracion): Configuracion {
  const insertar = db().prepare(
    `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
     ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor`
  )

  const aplicar = db().transaction(() => {
    if (cambios.dias_plazo_default !== undefined) {
      insertar.run('dias_plazo_default', String(Math.max(0, cambios.dias_plazo_default)))
    }
    if (cambios.dias_aviso_vencimiento !== undefined) {
      insertar.run('dias_aviso_vencimiento', String(Math.max(0, cambios.dias_aviso_vencimiento)))
    }
    if (cambios.nombre_local !== undefined) {
      insertar.run('nombre_local', cambios.nombre_local.trim() || 'Punto de Retiro')
    }
    if (cambios.usar_ubicaciones !== undefined) {
      insertar.run('usar_ubicaciones', cambios.usar_ubicaciones ? '1' : '0')
    }
    if (cambios.ubicaciones !== undefined) {
      const limpias = [...new Set(cambios.ubicaciones.map((u) => u.trim()).filter(Boolean))]
      insertar.run('ubicaciones', JSON.stringify(limpias))
    }
    if (cambios.carpeta_respaldo !== undefined) {
      insertar.run('carpeta_respaldo', cambios.carpeta_respaldo.trim())
    }
  })

  aplicar()
  return obtenerConfiguracion()
}
