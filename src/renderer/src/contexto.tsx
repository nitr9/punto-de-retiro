/*
 * Estado que necesitan todas las pantallas: la configuracion, quien esta
 * atendiendo y el resumen del stock.
 *
 * Se comparte por contexto en vez de pasarlo por props porque `refrescar` lo
 * llama cualquier pantalla despues de tocar la base, y el contador del panel
 * lateral tiene que quedar al dia sin importar desde donde se hizo el cambio.
 */

import { createContext, useContext } from 'react'
import type { Configuracion, Operador, ResumenStock } from '@shared/types'

export interface ValorContexto {
  config: Configuracion
  operadores: Operador[]
  operadorId: number | null
  cambiarOperador: (id: number | null) => void
  resumen: ResumenStock
  refrescar: () => Promise<void>
}

export const ContextoApp = createContext<ValorContexto | null>(null)

export function useApp(): ValorContexto {
  const valor = useContext(ContextoApp)
  if (!valor) throw new Error('useApp debe usarse dentro del proveedor de la aplicación.')
  return valor
}
