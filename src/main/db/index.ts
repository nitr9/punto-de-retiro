/*
 * Apertura de la base y copias de seguridad.
 *
 * La base vive en %APPDATA%\punto-retiro\datos\, fuera de la carpeta de
 * instalacion: reinstalar o desinstalar la app no toca los datos.
 *
 * La conexion se abre perezosamente, en la primera consulta (que ya llega por
 * IPC, con la ventana visible). Abrirla durante el arranque dejaba la ventana
 * sin aparecer y Windows marcaba la app como "no responde".
 */

import type BetterSqlite3 from 'better-sqlite3'
import type { Database } from 'better-sqlite3'
import { app } from 'electron'
import fs from 'fs'
import { copyFile } from 'fs/promises'
import path from 'path'
import { SCHEMA_SQL, sembrarDatosIniciales } from './schema'
import { hoy } from '@shared/fechas'
import type { EstadoRespaldo } from '@shared/types'

const BACKUPS_A_CONSERVAR = 30

let conexion: Database | null = null

/**
 * Se carga con `require` en el momento de usarlo y no con un `import` arriba
 * para que el modulo nativo no se resuelva mientras Electron todavia arranca.
 */
function driver(): typeof BetterSqlite3 {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('better-sqlite3')
}

function carpetaDatos(): string {
  const carpeta = path.join(app.getPath('userData'), 'datos')
  if (!fs.existsSync(carpeta)) fs.mkdirSync(carpeta, { recursive: true })
  return carpeta
}

export function rutaBaseDeDatos(): string {
  return path.join(carpetaDatos(), 'punto-retiro.db')
}

function carpetaBackups(): string {
  const carpeta = path.join(carpetaDatos(), 'backups')
  if (!fs.existsSync(carpeta)) fs.mkdirSync(carpeta, { recursive: true })
  return carpeta
}

/** Nombre de la copia de un dia. Un solo lugar para no desincronizar el filtro. */
function nombreCopia(fecha: string): string {
  return `punto-retiro-${fecha}.db`
}

function esCopia(nombre: string): boolean {
  return nombre.startsWith('punto-retiro-') && nombre.endsWith('.db')
}

/** Deja las `BACKUPS_A_CONSERVAR` mas nuevas y borra el resto. */
function limpiarCopiasViejas(carpeta: string): void {
  const copias = fs
    .readdirSync(carpeta)
    .filter(esCopia)
    .map((n) => ({ nombre: n, ruta: path.join(carpeta, n) }))
    .sort((a, b) => fs.statSync(b.ruta).mtimeMs - fs.statSync(a.ruta).mtimeMs)

  for (const vieja of copias.slice(BACKUPS_A_CONSERVAR)) fs.unlinkSync(vieja.ruta)
}

/**
 * Copia diaria, una por dia como maximo.
 *
 * Usa el respaldo por paginas de SQLite (`db.backup()`, asincronico) en vez de
 * copiar el archivo: copiarlo entero de forma sincronica congelaba la ventana,
 * y el problema iba a empeorar a medida que creciera la base.
 *
 * Si hay una segunda carpeta configurada, la copia se duplica ahi. Esa parte
 * nunca corta el respaldo local: que el pendrive no este enchufado es normal, y
 * no puede impedir que se guarde la copia de la maquina.
 */
export async function respaldarSiCorresponde(carpetaExterna: string): Promise<void> {
  const rutaOrigen = rutaBaseDeDatos()
  if (!fs.existsSync(rutaOrigen)) return

  const fecha = hoy()
  const destino = path.join(carpetaBackups(), nombreCopia(fecha))

  if (!fs.existsSync(destino)) {
    try {
      await db().backup(destino)
    } catch (error) {
      console.error('No se pudo crear la copia de seguridad:', error)
      return
    }

    try {
      limpiarCopiasViejas(carpetaBackups())
    } catch (error) {
      console.error('No se pudieron limpiar copias antiguas:', error)
    }
  }

  await copiarAcarpetaExterna(destino, fecha, carpetaExterna)
}

/**
 * Duplica la copia del dia en la carpeta que eligio el dueno.
 *
 * Copia el archivo ya generado en vez de correr `db().backup()` de nuevo: es el
 * mismo snapshot consistente, y evita una segunda pasada sobre la base.
 */
async function copiarAcarpetaExterna(
  origen: string,
  fecha: string,
  carpeta: string
): Promise<void> {
  if (!carpeta) return

  try {
    // Si el pendrive no esta conectado, la carpeta no existe y se sale sin ruido.
    if (!fs.existsSync(carpeta)) {
      console.error('La carpeta de respaldo no está disponible:', carpeta)
      return
    }

    const destino = path.join(carpeta, nombreCopia(fecha))
    if (!fs.existsSync(destino)) await copyFile(origen, destino)

    limpiarCopiasViejas(carpeta)
  } catch (error) {
    console.error('No se pudo copiar el respaldo a la carpeta externa:', error)
  }
}

/** Lo que mira Configuracion para mostrar si las copias se estan haciendo. */
export function estadoRespaldo(carpeta: string): EstadoRespaldo {
  let copias: string[] = []
  try {
    copias = fs.readdirSync(carpetaBackups()).filter(esCopia).sort()
  } catch {
    copias = []
  }

  const ultima = copias.length ? copias[copias.length - 1] : null
  // El nombre es `punto-retiro-YYYY-MM-DD.db`: la fecha sale del propio nombre.
  const ultimaFecha = ultima ? ultima.slice('punto-retiro-'.length, -'.db'.length) : null

  let disponible = false
  let alDia = false
  if (carpeta) {
    disponible = fs.existsSync(carpeta)
    alDia = Boolean(
      disponible && ultimaFecha && fs.existsSync(path.join(carpeta, nombreCopia(ultimaFecha)))
    )
  }

  return {
    ultima_copia: ultimaFecha,
    copias_locales: copias.length,
    carpeta_local: carpetaBackups(),
    carpeta_externa: carpeta || null,
    externa_disponible: disponible,
    externa_al_dia: alDia
  }
}

function abrirBaseDeDatos(): Database {
  if (conexion) return conexion

  const Driver = driver()
  const base = new Driver(rutaBaseDeDatos())
  base.pragma('journal_mode = WAL')
  base.pragma('foreign_keys = ON')
  base.exec(SCHEMA_SQL)
  sembrarDatosIniciales(base)

  conexion = base
  return base
}

/** Punto de entrada de toda la capa de datos. */
export function db(): Database {
  if (!conexion) return abrirBaseDeDatos()
  return conexion
}

export function cerrarBaseDeDatos(): void {
  if (!conexion) return
  try {
    conexion.close()
  } finally {
    conexion = null
  }
}

/**
 * Copia la base a donde elija el usuario. El checkpoint vuelca antes el WAL,
 * si no la copia queda sin los ultimos movimientos.
 */
export function exportarCopia(destino: string): void {
  db().pragma('wal_checkpoint(TRUNCATE)')
  fs.copyFileSync(rutaBaseDeDatos(), destino)
}
