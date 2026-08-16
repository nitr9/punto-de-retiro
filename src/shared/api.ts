/*
 * Contrato del puente entre la interfaz y el proceso principal.
 *
 * Es el unico lugar donde se nombran los canales de IPC: `ipc.ts` los registra
 * y el preload los invoca, asi que un canal mal escrito no compila.
 */

import type {
  CambiosConfiguracion,
  CambiosLote,
  CambiosOperador,
  CambiosPaquete,
  Configuracion,
  DatosEntrega,
  DatosIngreso,
  DatosLote,
  EstadoRespaldo,
  FiltroPaquetes,
  Lote,
  Movimiento,
  Operador,
  PaqueteDetallado,
  ResultadoBusqueda,
  ResultadoIngreso,
  ResumenDia,
  ResumenStock,
  RolOperador
} from './types'

export const CANALES = {
  paquetesIngresar: 'paquetes:ingresar',
  paquetesBuscar: 'paquetes:buscar',
  paquetesPorCodigo: 'paquetes:por-codigo',
  paquetesPorId: 'paquetes:por-id',
  paquetesEntregar: 'paquetes:entregar',
  paquetesDevolver: 'paquetes:devolver',
  paquetesActualizar: 'paquetes:actualizar',
  paquetesResumen: 'paquetes:resumen',
  paquetesResumenPorDia: 'paquetes:resumen-por-dia',
  paquetesMovimientos: 'paquetes:movimientos',
  lotesAbierto: 'lotes:abierto',
  lotesCrear: 'lotes:crear',
  lotesActualizar: 'lotes:actualizar',
  lotesCerrar: 'lotes:cerrar',
  lotesListar: 'lotes:listar',
  operadoresListar: 'operadores:listar',
  operadoresCrear: 'operadores:crear',
  operadoresActualizar: 'operadores:actualizar',
  configObtener: 'config:obtener',
  configGuardar: 'config:guardar',
  configRutaBase: 'config:ruta-base',
  configExportar: 'config:exportar',
  configElegirCarpeta: 'config:elegir-carpeta',
  configEstadoRespaldo: 'config:estado-respaldo'
} as const

/**
 * Sobre en el que viaja toda respuesta del proceso principal.
 *
 * Sin esto, un error del lado de la base llega a la pantalla como el texto
 * interno de Electron ("Error invoking remote method..."), que no le dice nada
 * a quien esta atendiendo el mostrador. El preload lo abre y lanza un `Error`
 * normal con el mensaje de adentro.
 */
export type Respuesta<T> = { ok: true; dato: T } | { ok: false; mensaje: string }

export interface Api {
  paquetes: {
    ingresar: (datos: DatosIngreso) => Promise<ResultadoIngreso>
    buscar: (filtro?: FiltroPaquetes) => Promise<ResultadoBusqueda>
    porCodigo: (codigo: string) => Promise<PaqueteDetallado | null>
    porId: (id: number) => Promise<PaqueteDetallado | null>
    entregar: (datos: DatosEntrega) => Promise<PaqueteDetallado | null>
    devolver: (
      ids: number[],
      operadorId?: number | null,
      motivo?: string
    ) => Promise<number>
    actualizar: (
      id: number,
      cambios: CambiosPaquete,
      operadorId?: number | null
    ) => Promise<PaqueteDetallado | null>
    resumen: () => Promise<ResumenStock>
    resumenPorDia: (desde: string, hasta: string) => Promise<ResumenDia[]>
    movimientos: (paqueteId: number) => Promise<Movimiento[]>
  }
  lotes: {
    abierto: () => Promise<Lote | null>
    crear: (datos: DatosLote) => Promise<Lote | null>
    actualizar: (id: number, cambios: CambiosLote) => Promise<Lote | null>
    cerrar: (id: number) => Promise<Lote | null>
    listar: (limite?: number) => Promise<Lote[]>
  }
  operadores: {
    listar: (soloActivos?: boolean) => Promise<Operador[]>
    crear: (nombre: string, rol?: RolOperador) => Promise<Operador | null>
    actualizar: (id: number, cambios: CambiosOperador) => Promise<Operador | null>
  }
  configuracion: {
    obtener: () => Promise<Configuracion>
    guardar: (cambios: CambiosConfiguracion) => Promise<Configuracion>
    rutaBase: () => Promise<string>
    /** Devuelve la ruta elegida, o `null` si se cancelo el dialogo. */
    exportarCopia: () => Promise<string | null>
    /** Abre el selector de carpetas. `null` si se cancelo. */
    elegirCarpeta: () => Promise<string | null>
    estadoRespaldo: () => Promise<EstadoRespaldo>
  }
}
