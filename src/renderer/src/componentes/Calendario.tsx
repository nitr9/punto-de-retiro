/*
 * Calendario mensual: cuantos paquetes entraron y salieron cada dia.
 *
 * Reemplaza la carpeta de planillas de Excel, que era una hoja por fecha.
 * Un clic en un dia filtra el listado por esa fecha de ingreso.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { aFecha, hoy } from '@shared/fechas'
import type { ResumenDia } from '@shared/types'

// La semana arranca en lunes, como los almanaques de acá.
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre'
]

/** `getDay()` devuelve 0 para domingo; acá el lunes es 0. */
function diaDeSemana(fecha: Date): number {
  return (fecha.getDay() + 6) % 7
}

export function Calendario({
  diaSeleccionado,
  onElegirDia
}: {
  diaSeleccionado: string | null
  onElegirDia: (dia: string | null) => void
}): JSX.Element {
  const [mesVisible, setMesVisible] = useState(() => {
    const d = new Date()
    return { anio: d.getFullYear(), mes: d.getMonth() }
  })
  const [datos, setDatos] = useState<Map<string, ResumenDia>>(new Map())

  const { anio, mes } = mesVisible

  const cargar = useCallback(async () => {
    // El dia 0 del mes siguiente es el ultimo del mes actual.
    const desde = aFecha(new Date(anio, mes, 1))
    const hasta = aFecha(new Date(anio, mes + 1, 0))
    try {
      const filas = await window.api.paquetes.resumenPorDia(desde, hasta)
      setDatos(new Map(filas.map((f) => [f.dia, f])))
    } catch {
      setDatos(new Map())
    }
  }, [anio, mes])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const celdas = useMemo(() => {
    const primero = new Date(anio, mes, 1)
    const diasEnMes = new Date(anio, mes + 1, 0).getDate()
    // Huecos hasta que arranca el primer dia del mes, para que caiga en su columna.
    const huecos = diaDeSemana(primero)
    const lista: (string | null)[] = Array(huecos).fill(null)
    for (let d = 1; d <= diasEnMes; d++) lista.push(aFecha(new Date(anio, mes, d)))
    return lista
  }, [anio, mes])

  const fechaHoy = hoy()
  const totalMes = [...datos.values()].reduce((suma, d) => suma + d.ingresados, 0)

  function moverMes(delta: number): void {
    setMesVisible(({ anio: a, mes: m }) => {
      const d = new Date(a, m + delta, 1)
      return { anio: d.getFullYear(), mes: d.getMonth() }
    })
  }

  return (
    <div className="calendario">
      <div className="calendario__cabecera">
        <button className="boton-mini" onClick={() => moverMes(-1)} aria-label="Mes anterior">
          ←
        </button>
        <div className="calendario__mes">
          {MESES[mes]} {anio}
          <span className="calendario__total">
            {totalMes === 0
              ? 'sin movimientos'
              : `${totalMes} paquete${totalMes === 1 ? '' : 's'} recibidos`}
          </span>
        </div>
        <button className="boton-mini" onClick={() => moverMes(1)} aria-label="Mes siguiente">
          →
        </button>
      </div>

      <div className="calendario__grilla">
        {DIAS_SEMANA.map((d) => (
          <div className="calendario__dia-semana" key={d}>
            {d}
          </div>
        ))}

        {celdas.map((fecha, i) => {
          if (!fecha) return <div key={`hueco-${i}`} />

          const info = datos.get(fecha)
          const numero = Number(fecha.slice(8, 10))
          const clases = ['calendario__dia']
          if (fecha === diaSeleccionado) clases.push('calendario__dia--elegido')
          if (fecha === fechaHoy) clases.push('calendario__dia--hoy')
          if (!info) clases.push('calendario__dia--vacio')

          return (
            <button
              key={fecha}
              className={clases.join(' ')}
              // Volver a tocar el dia elegido saca el filtro.
              onClick={() => onElegirDia(fecha === diaSeleccionado ? null : fecha)}
              title={
                info
                  ? `${info.ingresados} recibidos, ${info.entregados} entregados`
                  : 'Sin movimientos'
              }
            >
              <span className="calendario__numero">{numero}</span>
              {info && info.ingresados > 0 && (
                <span className="calendario__conteo">{info.ingresados}</span>
              )}
              {info && info.entregados > 0 && (
                <span className="calendario__entregados">{info.entregados} ent.</span>
              )}
            </button>
          )
        })}
      </div>

      <div className="calendario__pie">
        <span>
          <b>Número grande:</b> paquetes recibidos ese día
        </span>
        <span>
          <b>En verde:</b> entregados
        </span>
        {diaSeleccionado && (
          <button className="boton-mini" onClick={() => onElegirDia(null)}>
            Ver todos los días
          </button>
        )}
      </div>
    </div>
  )
}
