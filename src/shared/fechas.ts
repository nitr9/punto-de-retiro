/*
 * Fechas como texto, en hora local.
 *
 * Se guardan como `YYYY-MM-DD HH:mm:ss` segun el reloj de la maquina, no en UTC:
 * los reportes son "lo que entro hoy" segun el reloj del mostrador, y con UTC
 * lo que entra despues de las 21 h en Argentina caeria en el dia siguiente.
 */

function dosDigitos(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** Fecha y hora actual: `YYYY-MM-DD HH:mm:ss`. */
export function ahora(): string {
  return `${hoy()} ${horaActual()}`
}

/** Fecha de hoy: `YYYY-MM-DD`. */
export function hoy(): string {
  return aFecha(new Date())
}

/** Hora actual: `HH:mm:ss`. */
export function horaActual(): string {
  const d = new Date()
  return `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}:${dosDigitos(d.getSeconds())}`
}

/** Pasa un `Date` a `YYYY-MM-DD`. */
export function aFecha(d: Date): string {
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`
}

/**
 * Lee la parte de fecha de un texto guardado. Construye el `Date` con los
 * componentes sueltos a proposito: `new Date('2026-08-13')` lo interpreta como
 * UTC y puede correr un dia.
 */
export function desdeTexto(texto: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export function sumarDias(fecha: string, dias: number): string {
  const d = desdeTexto(fecha)
  if (!d) return fecha
  d.setDate(d.getDate() + dias)
  return aFecha(d)
}

/** Dias enteros de `desde` a `hasta`. Negativo si `hasta` ya paso. */
export function diasEntre(desde: string, hasta: string): number | null {
  const a = desdeTexto(desde)
  const b = desdeTexto(hasta)
  if (!a || !b) return null
  const MS_POR_DIA = 24 * 60 * 60 * 1000
  return Math.round((b.getTime() - a.getTime()) / MS_POR_DIA)
}
