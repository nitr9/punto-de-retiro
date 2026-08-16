/*
 * Piezas que se repiten en las cuatro pantallas, y el formateo de fechas
 * para mostrar.
 *
 * Las fechas se guardan como `YYYY-MM-DD` y se muestran como `DD/MM/AAAA`, que
 * es como las lee cualquiera en el mostrador.
 */

import type { ReactNode } from 'react'
import type { EstadoPaquete, PaqueteDetallado } from '@shared/types'

export function formatearFecha(texto: string | null): string {
  if (!texto) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto)
  if (!m) return texto
  return `${m[3]}/${m[2]}/${m[1]}`
}

export function formatearFechaHora(texto: string | null): string {
  if (!texto) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(texto)
  if (!m) return formatearFecha(texto)
  return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`
}

export function horaDe(texto: string | null): string {
  if (!texto) return ''
  const m = /[ T](\d{2}):(\d{2})/.exec(texto)
  return m ? `${m[1]}:${m[2]}` : ''
}

/** "Vence en 3 días" se entiende de un vistazo; una fecha sola hay que calcularla. */
export function textoVencimiento(diasRestantes: number | null): string {
  if (diasRestantes === null) return 'Sin fecha limite'
  if (diasRestantes === 0) return 'Vence hoy'
  if (diasRestantes === 1) return 'Vence mañana'
  if (diasRestantes > 1) return `Vence en ${diasRestantes} días`
  if (diasRestantes === -1) return 'Vencido ayer'
  return `Vencido hace ${Math.abs(diasRestantes)} días`
}

export type TipoAviso = 'ok' | 'error' | 'alerta' | 'info'

export function Aviso({ tipo, children }: { tipo: TipoAviso; children: ReactNode }): JSX.Element {
  return (
    <div className={`aviso aviso--${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
    </div>
  )
}

/** El semaforo: rojo si vencio, amarillo si esta por vencer, verde si hay tiempo. */
export function EtiquetaVencimiento({
  paquete,
  diasAviso
}: {
  paquete: PaqueteDetallado
  diasAviso: number
}): JSX.Element {
  if (paquete.estado !== 'EN_STOCK') return <EtiquetaEstado estado={paquete.estado} />

  const dias = paquete.dias_restantes
  if (dias === null) return <span className="etiqueta etiqueta--neutra">Sin fecha límite</span>

  const clase = dias < 0 ? 'peligro' : dias <= diasAviso ? 'alerta' : 'ok'
  return <span className={`etiqueta etiqueta--${clase}`}>{textoVencimiento(dias)}</span>
}

const TEXTO_ESTADO: Record<EstadoPaquete, { texto: string; clase: string }> = {
  EN_STOCK: { texto: 'En stock', clase: 'info' },
  ENTREGADO: { texto: 'Entregado', clase: 'ok' },
  DEVUELTO: { texto: 'Devuelto a ML', clase: 'neutra' },
  INCIDENCIA: { texto: 'Con incidencia', clase: 'peligro' }
}

export function EtiquetaEstado({ estado }: { estado: EstadoPaquete }): JSX.Element {
  const { texto, clase } = TEXTO_ESTADO[estado]
  return <span className={`etiqueta etiqueta--${clase}`}>{texto}</span>
}

export function Ubicacion({ valor }: { valor: string | null }): JSX.Element {
  if (!valor) return <span className="ubicacion ubicacion--vacia">Sin ubicar</span>
  return <span className="ubicacion">{valor}</span>
}

export function Vacio({ titulo, detalle }: { titulo: string; detalle?: string }): JSX.Element {
  return (
    <div className="vacio">
      <div className="vacio__titulo">{titulo}</div>
      {detalle && <div>{detalle}</div>}
    </div>
  )
}

export function Modal({
  titulo,
  onCerrar,
  children,
  pie
}: {
  titulo: string
  onCerrar: () => void
  children: ReactNode
  pie?: ReactNode
}): JSX.Element {
  return (
    <div
      className="modal-fondo"
      // `onMouseDown` y no `onClick`: si se empieza a seleccionar texto adentro
      // del modal y se suelta afuera, con `onClick` se cerraria sin querer.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar()
      }}
    >
      <div className="modal" role="dialog" aria-label={titulo}>
        <div className="modal__cabecera">
          <h2>{titulo}</h2>
          <button className="cerrar" onClick={onCerrar} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className="modal__cuerpo">{children}</div>
        {pie && <div className="modal__pie">{pie}</div>}
      </div>
    </div>
  )
}
