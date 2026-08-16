/*
 * Puente entre la interfaz y el proceso principal.
 *
 * La interfaz no tiene acceso a Node ni a la base: todo pasa por `window.api`.
 * Aca se abre el sobre `Respuesta<T>` y se lanza un `Error` comun, para que las
 * pantallas puedan usar `try/catch` sin conocer el formato del IPC.
 */

import { contextBridge, ipcRenderer } from 'electron'
import { CANALES, type Api, type Respuesta } from '@shared/api'

async function llamar<T>(canal: string, ...args: unknown[]): Promise<T> {
  const respuesta: Respuesta<T> = await ipcRenderer.invoke(canal, ...args)
  if (!respuesta.ok) throw new Error(respuesta.mensaje)
  return respuesta.dato
}

const api: Api = {
  paquetes: {
    ingresar: (datos) => llamar(CANALES.paquetesIngresar, datos),
    buscar: (filtro) => llamar(CANALES.paquetesBuscar, filtro),
    porCodigo: (codigo) => llamar(CANALES.paquetesPorCodigo, codigo),
    porId: (id) => llamar(CANALES.paquetesPorId, id),
    entregar: (datos) => llamar(CANALES.paquetesEntregar, datos),
    devolver: (ids, operadorId, motivo) =>
      llamar(CANALES.paquetesDevolver, ids, operadorId, motivo),
    actualizar: (id, cambios, operadorId) =>
      llamar(CANALES.paquetesActualizar, id, cambios, operadorId),
    resumen: () => llamar(CANALES.paquetesResumen),
    resumenPorDia: (desde, hasta) => llamar(CANALES.paquetesResumenPorDia, desde, hasta),
    movimientos: (paqueteId) => llamar(CANALES.paquetesMovimientos, paqueteId)
  },
  lotes: {
    abierto: () => llamar(CANALES.lotesAbierto),
    crear: (datos) => llamar(CANALES.lotesCrear, datos),
    actualizar: (id, cambios) => llamar(CANALES.lotesActualizar, id, cambios),
    cerrar: (id) => llamar(CANALES.lotesCerrar, id),
    listar: (limite) => llamar(CANALES.lotesListar, limite)
  },
  operadores: {
    listar: (soloActivos) => llamar(CANALES.operadoresListar, soloActivos),
    crear: (nombre, rol) => llamar(CANALES.operadoresCrear, nombre, rol),
    actualizar: (id, cambios) => llamar(CANALES.operadoresActualizar, id, cambios)
  },
  configuracion: {
    obtener: () => llamar(CANALES.configObtener),
    guardar: (cambios) => llamar(CANALES.configGuardar, cambios),
    rutaBase: () => llamar(CANALES.configRutaBase),
    exportarCopia: () => llamar(CANALES.configExportar),
    elegirCarpeta: () => llamar(CANALES.configElegirCarpeta),
    estadoRespaldo: () => llamar(CANALES.configEstadoRespaldo)
  }
}

contextBridge.exposeInMainWorld('api', api)
