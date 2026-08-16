/*
 * Canales de IPC.
 *
 * Cada handler devuelve un sobre `Respuesta<T>` en vez de dejar propagar la
 * excepcion: si se propaga, Electron la envuelve y a la pantalla llega
 * "Error invoking remote method 'paquetes:ingresar'", que no le sirve a nadie
 * en el mostrador. Asi llega el mensaje real.
 */

import { BrowserWindow, dialog, ipcMain } from 'electron'
import path from 'path'
import { app } from 'electron'
import { CANALES, type Respuesta } from '@shared/api'
import { hoy } from '@shared/fechas'
import { estadoRespaldo, exportarCopia, rutaBaseDeDatos } from './db'
import { obtenerConfiguracion, guardarConfiguracion } from './db/configuracion'
import {
  actualizarPaquete,
  buscar,
  buscarPorCodigo,
  entregar,
  listarMovimientos,
  marcarDevueltos,
  obtenerPaquete,
  registrarIngreso,
  resumenPorDia,
  resumenStock
} from './db/paquetes'
import {
  actualizarLote,
  cerrarLote,
  crearLote,
  listarLotes,
  loteAbierto
} from './db/lotes'
import { actualizarOperador, crearOperador, listarOperadores } from './db/operadores'

function manejar<T>(canal: string, fn: (...args: never[]) => T | Promise<T>): void {
  ipcMain.handle(canal, async (_evento, ...args): Promise<Respuesta<T>> => {
    try {
      return { ok: true, dato: await fn(...(args as never[])) }
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Ocurrió un error inesperado.'
      console.error(`[${canal}]`, error)
      return { ok: false, mensaje }
    }
  })
}

export function registrarCanales(): void {
  manejar(CANALES.paquetesIngresar, registrarIngreso)
  manejar(CANALES.paquetesBuscar, (filtro) => buscar(filtro ?? {}))
  manejar(CANALES.paquetesPorCodigo, buscarPorCodigo)
  manejar(CANALES.paquetesPorId, obtenerPaquete)
  manejar(CANALES.paquetesEntregar, entregar)
  manejar(CANALES.paquetesDevolver, (ids, operadorId, motivo) =>
    marcarDevueltos(ids, operadorId ?? null, motivo)
  )
  manejar(CANALES.paquetesActualizar, (id, cambios, operadorId) =>
    actualizarPaquete(id, cambios, operadorId ?? null)
  )
  manejar(CANALES.paquetesResumen, resumenStock)
  manejar(CANALES.paquetesResumenPorDia, resumenPorDia)
  manejar(CANALES.paquetesMovimientos, listarMovimientos)

  manejar(CANALES.lotesAbierto, loteAbierto)
  manejar(CANALES.lotesCrear, crearLote)
  manejar(CANALES.lotesActualizar, actualizarLote)
  manejar(CANALES.lotesCerrar, cerrarLote)
  manejar(CANALES.lotesListar, (limite) => listarLotes(limite ?? 50))

  manejar(CANALES.operadoresListar, (soloActivos) => listarOperadores(soloActivos ?? false))
  manejar(CANALES.operadoresCrear, (nombre, rol) => crearOperador(nombre, rol))
  manejar(CANALES.operadoresActualizar, actualizarOperador)

  manejar(CANALES.configObtener, obtenerConfiguracion)
  manejar(CANALES.configGuardar, guardarConfiguracion)
  manejar(CANALES.configRutaBase, rutaBaseDeDatos)

  manejar(CANALES.configExportar, async () => {
    const ventana = BrowserWindow.getFocusedWindow()
    const opciones = {
      title: 'Guardar copia de seguridad',
      defaultPath: path.join(app.getPath('documents'), `punto-retiro-${hoy()}.db`),
      filters: [{ name: 'Base de datos', extensions: ['db'] }]
    }

    const resultado = ventana
      ? await dialog.showSaveDialog(ventana, opciones)
      : await dialog.showSaveDialog(opciones)

    if (resultado.canceled || !resultado.filePath) return null
    exportarCopia(resultado.filePath)
    return resultado.filePath
  })

  manejar(CANALES.configElegirCarpeta, async () => {
    const ventana = BrowserWindow.getFocusedWindow()
    const opciones = {
      title: 'Elegir la carpeta donde guardar la copia diaria',
      properties: ['openDirectory' as const, 'createDirectory' as const]
    }

    const resultado = ventana
      ? await dialog.showOpenDialog(ventana, opciones)
      : await dialog.showOpenDialog(opciones)

    if (resultado.canceled || !resultado.filePaths.length) return null
    return resultado.filePaths[0]
  })

  manejar(CANALES.configEstadoRespaldo, () =>
    estadoRespaldo(obtenerConfiguracion().carpeta_respaldo)
  )
}
