/*
 * Paquetes en stock.
 *
 * Responde las preguntas que hoy no tienen respuesta rapida: cuantos hay, cuales
 * hay que devolver esta semana, donde esta guardado cada uno.
 *
 * El boton verde "Entregado" de cada fila es el equivalente exacto a pintar de
 * verde el renglon del Excel: un clic, sin abrir nada.
 */

import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../contexto'
import { Calendario } from '../componentes/Calendario'
import {
  Aviso,
  EtiquetaEstado,
  EtiquetaVencimiento,
  Modal,
  Ubicacion,
  Vacio,
  formatearFecha,
  formatearFechaHora,
  horaDe
} from '../componentes/Comunes'
import { hoy } from '@shared/fechas'
import type {
  CambiosPaquete,
  EstadoPaquete,
  Movimiento,
  PaqueteDetallado
} from '@shared/types'

export function Stock(): JSX.Element {
  const { config, operadorId, resumen, refrescar } = useApp()
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState<EstadoPaquete | 'TODOS'>('EN_STOCK')
  const [soloVencidos, setSoloVencidos] = useState(false)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [verCalendario, setVerCalendario] = useState(false)

  // Un solo dia elegido es cuando desde y hasta coinciden: eso es "la hoja del
  // dia" del Excel que usaban antes.
  const diaSeleccionado = desde && desde === hasta ? desde : null

  function elegirDia(dia: string | null): void {
    setDesde(dia ?? '')
    setHasta(dia ?? '')
    // Al mirar un dia interesa todo lo que entro, no solo lo que sigue en stock.
    if (dia) setEstado('TODOS')
  }

  const [paquetes, setPaquetes] = useState<PaqueteDetallado[]>([])
  // Cuantos coinciden en total: la consulta trae como maximo 500 filas.
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set())
  const [detalle, setDetalle] = useState<PaqueteDetallado | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const { paquetes: lista, total: cuantos } = await window.api.paquetes.buscar({
        texto: texto.trim() || undefined,
        estado,
        soloVencidos: soloVencidos || undefined,
        desde: desde || undefined,
        hasta: hasta || undefined
      })
      setPaquetes(lista)
      setTotal(cuantos)
      setSeleccion(new Set())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el listado.')
    } finally {
      setCargando(false)
    }
  }, [texto, estado, soloVencidos, desde, hasta])

  // Espera 200 ms antes de consultar: si no, cada tecla de la busqueda dispara
  // una consulta.
  useEffect(() => {
    const t = setTimeout(() => void cargar(), 200)
    return () => clearTimeout(t)
  }, [cargar])

  function alternar(id: number): void {
    setSeleccion((prev) => {
      const copia = new Set(prev)
      if (copia.has(id)) copia.delete(id)
      else copia.add(id)
      return copia
    })
  }

  const seleccionables = paquetes.filter((p) => p.estado === 'EN_STOCK')
  const todosSeleccionados =
    seleccionables.length > 0 && seleccionables.every((p) => seleccion.has(p.id))

  async function entregarRapido(paquete: PaqueteDetallado): Promise<void> {
    const quien = paquete.destinatario_nombre ?? 'el cliente'
    if (!window.confirm(`¿Marcar como entregado a ${quien} el paquete ${paquete.codigo_tracking}?`))
      return

    try {
      await window.api.paquetes.entregar({ paquete_id: paquete.id, operador_id: operadorId })
      await Promise.all([cargar(), refrescar()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la entrega.')
    }
  }

  async function devolverSeleccionados(): Promise<void> {
    if (seleccion.size === 0) return
    const cantidad = seleccion.size
    const confirmado = window.confirm(
      `Vas a marcar ${cantidad} paquete${cantidad > 1 ? 's' : ''} como devuelto${
        cantidad > 1 ? 's' : ''
      } a Mercado Libre.\n\nSalen del stock y dejan de figurar como pendientes. ¿Confirmás?`
    )
    if (!confirmado) return

    try {
      await window.api.paquetes.devolver([...seleccion], operadorId)
      await Promise.all([cargar(), refrescar()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la devolución.')
    }
  }

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Paquetes en stock</h1>
          <p>Lo que vence antes aparece primero.</p>
        </div>
      </div>

      <div className="tarjetas">
        <div className="tarjeta tarjeta--info">
          <div className="tarjeta__valor">{resumen.en_stock}</div>
          <div className="tarjeta__etiqueta">En stock</div>
        </div>
        <div className={`tarjeta ${resumen.vencidos > 0 ? 'tarjeta--peligro' : 'tarjeta--ok'}`}>
          <div className="tarjeta__valor">{resumen.vencidos}</div>
          <div className="tarjeta__etiqueta">Vencidos, para devolver</div>
        </div>
        <div className={`tarjeta ${resumen.por_vencer > 0 ? 'tarjeta--alerta' : ''}`}>
          <div className="tarjeta__valor">{resumen.por_vencer}</div>
          <div className="tarjeta__etiqueta">Por vencer</div>
        </div>
        {config.usar_ubicaciones && (
          <div className={`tarjeta ${resumen.sin_ubicacion > 0 ? 'tarjeta--alerta' : ''}`}>
            <div className="tarjeta__valor">{resumen.sin_ubicacion}</div>
            <div className="tarjeta__etiqueta">Sin ubicación cargada</div>
          </div>
        )}
        <div className="tarjeta tarjeta--ok">
          <div className="tarjeta__valor">{resumen.entregados_hoy}</div>
          <div className="tarjeta__etiqueta">Entregados hoy</div>
        </div>
        <div className="tarjeta">
          <div className="tarjeta__valor">{resumen.ingresados_hoy}</div>
          <div className="tarjeta__etiqueta">Recibidos hoy</div>
        </div>
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}

      <div className="panel">
        <div className="filtros">
          <label className="campo campo--ancho">
            <span>Buscar</span>
            <input
              type="search"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Código, nombre, DNI, teléfono o ubicación"
            />
          </label>
          <label className="campo">
            <span>Estado</span>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoPaquete | 'TODOS')}
            >
              <option value="EN_STOCK">En stock</option>
              <option value="ENTREGADO">Entregados</option>
              <option value="DEVUELTO">Devueltos a ML</option>
              <option value="TODOS">Todos</option>
            </select>
          </label>
          <label className="campo">
            <span>Ingresados desde</span>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label className="campo">
            <span>Hasta</span>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </label>
          <label className="campo">
            <span> </span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0' }}>
              <input
                type="checkbox"
                checked={soloVencidos}
                onChange={(e) => setSoloVencidos(e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              <span>Solo vencidos</span>
            </label>
          </label>
        </div>

        <div className="acciones" style={{ marginBottom: 14 }}>
          <button
            className={`boton-mini ${verCalendario ? 'boton-mini--primario' : ''}`}
            onClick={() => setVerCalendario((v) => !v)}
          >
            {verCalendario ? 'Ocultar calendario' : 'Ver por día (calendario)'}
          </button>
          <button
            className="boton-mini"
            onClick={() => {
              elegirDia(hoy())
              setVerCalendario(false)
            }}
          >
            Lo que entró hoy
          </button>
          <button
            className="boton-mini"
            onClick={() => {
              setDesde('')
              setHasta('')
              setTexto('')
              setSoloVencidos(false)
              setEstado('EN_STOCK')
              setVerCalendario(false)
            }}
          >
            Limpiar filtros
          </button>
        </div>

        {verCalendario && (
          <Calendario diaSeleccionado={diaSeleccionado} onElegirDia={elegirDia} />
        )}

        {diaSeleccionado && (
          <Aviso tipo="info">
            Mostrando los paquetes que entraron el {formatearFecha(diaSeleccionado)}.
          </Aviso>
        )}

        {seleccion.size > 0 && (
          <div className="acciones" style={{ marginBottom: 14 }}>
            <button className="boton boton--peligro" onClick={() => void devolverSeleccionados()}>
              Marcar {seleccion.size} como devuelto{seleccion.size > 1 ? 's' : ''} a Mercado Libre
            </button>
            <button className="boton boton--neutro" onClick={() => setSeleccion(new Set())}>
              Deseleccionar
            </button>
          </div>
        )}

        {cargando ? (
          <div style={{ padding: 30, color: '#56657a' }}>Buscando…</div>
        ) : paquetes.length === 0 ? (
          <Vacio
            titulo="No hay paquetes que coincidan"
            detalle="Probá cambiando el estado o limpiando la búsqueda."
          />
        ) : (
          <>
            {/* Si la consulta llego al tope, la tabla muestra menos filas que
                las que dicen los contadores de arriba. Decirlo es la diferencia
                entre una lista cortada y dos numeros que no cierran. */}
            {total > paquetes.length && (
              <Aviso tipo="alerta">
                Mostrando los primeros {paquetes.length} de {total} paquetes que coinciden. Filtrá
                por fecha o buscá por nombre para ver el resto.
              </Aviso>
            )}
            <div className="tabla-envoltorio">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 34 }}>
                    <input
                      type="checkbox"
                      checked={todosSeleccionados}
                      onChange={(e) =>
                        setSeleccion(
                          e.target.checked ? new Set(seleccionables.map((p) => p.id)) : new Set()
                        )
                      }
                      disabled={seleccionables.length === 0}
                      aria-label="Seleccionar todos"
                    />
                  </th>
                  <th>Código</th>
                  <th>Destinatario</th>
                  {config.usar_ubicaciones && <th>Ubicación</th>}
                  <th>Ingreso</th>
                  <th>Vencimiento</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {paquetes.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={seleccion.has(p.id)}
                        onChange={() => alternar(p.id)}
                        disabled={p.estado !== 'EN_STOCK'}
                        aria-label={`Seleccionar ${p.codigo_tracking}`}
                      />
                    </td>
                    <td className="celda-codigo">
                      {p.codigo_tracking}
                      {p.observaciones && (
                        <div
                          className="etiqueta etiqueta--alerta"
                          style={{ marginTop: 4, fontWeight: 600 }}
                          title={p.observaciones}
                        >
                          {p.observaciones}
                        </div>
                      )}
                    </td>
                    <td>
                      {p.destinatario_nombre ?? '—'}
                      {p.destinatario_dni && (
                        <div style={{ color: '#56657a', fontSize: 13 }}>
                          DNI {p.destinatario_dni}
                        </div>
                      )}
                    </td>
                    {config.usar_ubicaciones && (
                      <td>
                        <Ubicacion valor={p.ubicacion} />
                      </td>
                    )}
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {formatearFecha(p.fecha_ingreso)}
                      <div style={{ color: '#56657a', fontSize: 13 }}>{horaDe(p.fecha_ingreso)}</div>
                    </td>
                    <td>
                      {p.estado === 'EN_STOCK' ? (
                        <EtiquetaVencimiento
                          paquete={p}
                          diasAviso={config.dias_aviso_vencimiento}
                        />
                      ) : (
                        <EtiquetaEstado estado={p.estado} />
                      )}
                    </td>
                    <td className="fila-acciones">
                      {p.estado === 'EN_STOCK' && (
                        <button
                          className="boton-mini boton-mini--entregar"
                          onClick={() => void entregarRapido(p)}
                          title="Marcar como entregado"
                        >
                          Entregado
                        </button>
                      )}
                      <button className="boton-mini" onClick={() => setDetalle(p)}>
                        Ver / editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
      </div>

      {detalle && (
        <DetallePaquete
          paquete={detalle}
          usarUbicaciones={config.usar_ubicaciones}
          ubicaciones={config.ubicaciones}
          operadorId={operadorId}
          onCerrar={() => setDetalle(null)}
          onGuardado={async () => {
            setDetalle(null)
            await Promise.all([cargar(), refrescar()])
          }}
        />
      )}
    </>
  )
}

function DetallePaquete({
  paquete,
  usarUbicaciones,
  ubicaciones,
  operadorId,
  onCerrar,
  onGuardado
}: {
  paquete: PaqueteDetallado
  usarUbicaciones: boolean
  ubicaciones: string[]
  operadorId: number | null
  onCerrar: () => void
  onGuardado: () => Promise<void>
}): JSX.Element {
  // Todos los campos como texto: un `input` vacio da `""`, y la capa de datos
  // ya se encarga de convertirlo en NULL al guardar.
  const [campos, setCampos] = useState<Record<keyof CambiosPaquete, string>>({
    codigo_retiro: paquete.codigo_retiro ?? '',
    destinatario_nombre: paquete.destinatario_nombre ?? '',
    destinatario_dni: paquete.destinatario_dni ?? '',
    destinatario_telefono: paquete.destinatario_telefono ?? '',
    ubicacion: paquete.ubicacion ?? '',
    fecha_limite: paquete.fecha_limite ?? '',
    observaciones: paquete.observaciones ?? ''
  })
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void window.api.paquetes
      .movimientos(paquete.id)
      .then(setMovimientos)
      .catch(() => undefined)
  }, [paquete.id])

  function actualizar(clave: keyof CambiosPaquete, valor: string): void {
    setCampos((prev) => ({ ...prev, [clave]: valor }))
  }

  async function guardar(): Promise<void> {
    setGuardando(true)
    try {
      await window.api.paquetes.actualizar(paquete.id, campos, operadorId)
      await onGuardado()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar los cambios.')
      setGuardando(false)
    }
  }

  return (
    <Modal
      titulo={`Paquete ${paquete.codigo_tracking}`}
      onCerrar={onCerrar}
      pie={
        <>
          <button className="boton boton--neutro" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            className="boton boton--primario"
            onClick={() => void guardar()}
            disabled={guardando}
          >
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </>
      }
    >
      {error && <Aviso tipo="error">{error}</Aviso>}

      <div className="grilla grilla--2" style={{ marginBottom: 16 }}>
        {usarUbicaciones && (
          <label className="campo">
            <span>Ubicación</span>
            <input
              type="text"
              list="ubicaciones-detalle"
              value={campos.ubicacion}
              onChange={(e) => actualizar('ubicacion', e.target.value)}
            />
            <datalist id="ubicaciones-detalle">
              {ubicaciones.map((u) => (
                <option value={u} key={u} />
              ))}
            </datalist>
          </label>
        )}
        <label className="campo">
          <span>Fecha límite de retiro</span>
          <input
            type="date"
            value={campos.fecha_limite}
            onChange={(e) => actualizar('fecha_limite', e.target.value)}
          />
        </label>
        <label className="campo">
          <span>Destinatario</span>
          <input
            type="text"
            value={campos.destinatario_nombre}
            onChange={(e) => actualizar('destinatario_nombre', e.target.value)}
          />
        </label>
        <label className="campo">
          <span>DNI</span>
          <input
            type="text"
            value={campos.destinatario_dni}
            onChange={(e) => actualizar('destinatario_dni', e.target.value)}
          />
        </label>
        <label className="campo">
          <span>Teléfono</span>
          <input
            type="text"
            value={campos.destinatario_telefono}
            onChange={(e) => actualizar('destinatario_telefono', e.target.value)}
          />
        </label>
        <label className="campo">
          <span>Código de retiro</span>
          <input
            type="text"
            value={campos.codigo_retiro}
            onChange={(e) => actualizar('codigo_retiro', e.target.value)}
          />
        </label>
      </div>

      <label className="campo" style={{ marginBottom: 18 }}>
        <span>Observaciones</span>
        <textarea
          value={campos.observaciones}
          onChange={(e) => actualizar('observaciones', e.target.value)}
        />
      </label>

      <h3 className="panel__titulo">Historial</h3>
      {movimientos.length === 0 ? (
        <p style={{ color: '#56657a' }}>Sin movimientos registrados.</p>
      ) : (
        <div className="tabla-envoltorio">
          <table>
            <tbody>
              {movimientos.map((m) => (
                <tr key={m.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatearFechaHora(m.fecha)}</td>
                  <td>
                    <strong>{m.tipo}</strong>
                    {m.detalle && (
                      <div style={{ color: '#56657a', fontSize: 13 }}>{m.detalle}</div>
                    )}
                  </td>
                  <td style={{ color: '#56657a' }}>{m.operador_nombre ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}
