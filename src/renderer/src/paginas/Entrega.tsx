/*
 * Entregar paquete.
 *
 * Lo que hace que valga la pena abrirla: muestra en letra grande en que estante
 * esta guardado el paquete. Mercado Libre no da ese dato, asi que el empleado
 * la abre porque le conviene, no porque se lo mandaron.
 *
 * El caso rapido (marcar entregado desde el listado, un clic) esta en Stock.
 * Esta pantalla es para cuando viene un tercero o hay que buscar el paquete.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useApp } from '../contexto'
import {
  Aviso,
  EtiquetaEstado,
  EtiquetaVencimiento,
  Ubicacion,
  Vacio,
  formatearFecha,
  formatearFechaHora
} from '../componentes/Comunes'
import type { PaqueteDetallado } from '@shared/types'

export function Entrega(): JSX.Element {
  const { config, operadorId, refrescar } = useApp()
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<PaqueteDetallado[] | null>(null)
  const [seleccionado, setSeleccionado] = useState<PaqueteDetallado | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [quienRetira, setQuienRetira] = useState('')
  const [dniRetira, setDniRetira] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [entregando, setEntregando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const inputBusqueda = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputBusqueda.current?.focus()
  }, [])

  function volverAlBuscador(): void {
    setSeleccionado(null)
    setResultados(null)
    setBusqueda('')
    setQuienRetira('')
    setDniRetira('')
    setObservaciones('')
    setTimeout(() => inputBusqueda.current?.focus(), 0)
  }

  function elegir(paquete: PaqueteDetallado): void {
    setSeleccionado(paquete)
    setResultados(null)
    setError(null)
    // Precargado con el destinatario: en la mayoria de las entregas lo retira
    // el mismo, y asi no hay que escribir nada.
    setQuienRetira(paquete.destinatario_nombre ?? '')
    setDniRetira(paquete.destinatario_dni ?? '')
  }

  async function buscar(e: FormEvent): Promise<void> {
    e.preventDefault()
    const texto = busqueda.trim()
    if (!texto) return

    setBuscando(true)
    setError(null)
    setExito(null)
    try {
      // Un escaneo da con el codigo exacto: se salta la lista y va directo a la ficha.
      const porCodigo = await window.api.paquetes.porCodigo(texto)
      if (porCodigo) {
        elegir(porCodigo)
        return
      }

      const { paquetes: encontrados } = await window.api.paquetes.buscar({ texto, limite: 50 })
      const enStock = encontrados.filter((p) => p.estado === 'EN_STOCK')
      if (enStock.length === 1) {
        elegir(enStock[0])
      } else if (encontrados.length === 0) {
        setResultados([])
      } else {
        setResultados(encontrados)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo buscar el paquete.')
    } finally {
      setBuscando(false)
    }
  }

  async function confirmarEntrega(): Promise<void> {
    if (!seleccionado) return
    setEntregando(true)
    setError(null)
    try {
      await window.api.paquetes.entregar({
        paquete_id: seleccionado.id,
        retirado_por_nombre: quienRetira,
        retirado_por_dni: dniRetira,
        operador_id: operadorId,
        observaciones
      })
      const nombre = quienRetira.trim() || seleccionado.destinatario_nombre
      setExito(
        nombre
          ? `Paquete ${seleccionado.codigo_tracking} entregado a ${nombre}.`
          : `Paquete ${seleccionado.codigo_tracking} entregado.`
      )
      await refrescar()
      volverAlBuscador()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la entrega.')
    } finally {
      setEntregando(false)
    }
  }

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Entregar paquete</h1>
          <p>Escaneá el código del cliente o buscá por nombre, DNI o teléfono.</p>
        </div>
      </div>

      {exito && <Aviso tipo="ok">{exito}</Aviso>}
      {error && <Aviso tipo="error">{error}</Aviso>}

      {!seleccionado && (
        <div className="panel">
          <form className="escaner" onSubmit={(e) => void buscar(e)}>
            <input
              ref={inputBusqueda}
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Código, nombre, DNI o teléfono"
              autoComplete="off"
              spellCheck={false}
            />
            <button className="boton boton--primario boton--grande" disabled={buscando}>
              {buscando ? 'Buscando…' : 'Buscar'}
            </button>
          </form>
        </div>
      )}

      {resultados !== null && resultados.length === 0 && (
        <div className="panel">
          <Vacio
            titulo="No se encontró ningún paquete"
            detalle="Revisá el código o probá buscando por el apellido del cliente."
          />
        </div>
      )}

      {resultados !== null && resultados.length > 0 && (
        <div className="panel">
          <h2 className="panel__titulo">{resultados.length} coincidencias — elegí cuál entregar</h2>
          <div className="tabla-envoltorio">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Destinatario</th>
                  {config.usar_ubicaciones && <th>Ubicación</th>}
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {resultados.map((p) => (
                  <tr key={p.id}>
                    <td className="celda-codigo">{p.codigo_tracking}</td>
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
                    <td>
                      <EtiquetaVencimiento
                        paquete={p}
                        diasAviso={config.dias_aviso_vencimiento}
                      />
                    </td>
                    <td className="fila-acciones">
                      {p.estado === 'EN_STOCK' ? (
                        <button className="boton-mini boton-mini--primario" onClick={() => elegir(p)}>
                          Seleccionar
                        </button>
                      ) : (
                        <EtiquetaEstado estado={p.estado} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {seleccionado && (
        <FichaEntrega
          paquete={seleccionado}
          diasAviso={config.dias_aviso_vencimiento}
          usarUbicaciones={config.usar_ubicaciones}
          quienRetira={quienRetira}
          dniRetira={dniRetira}
          observaciones={observaciones}
          entregando={entregando}
          onQuienRetira={setQuienRetira}
          onDniRetira={setDniRetira}
          onObservaciones={setObservaciones}
          onCancelar={volverAlBuscador}
          onConfirmar={() => void confirmarEntrega()}
        />
      )}
    </>
  )
}

function FichaEntrega({
  paquete,
  diasAviso,
  usarUbicaciones,
  quienRetira,
  dniRetira,
  observaciones,
  entregando,
  onQuienRetira,
  onDniRetira,
  onObservaciones,
  onCancelar,
  onConfirmar
}: {
  paquete: PaqueteDetallado
  diasAviso: number
  usarUbicaciones: boolean
  quienRetira: string
  dniRetira: string
  observaciones: string
  entregando: boolean
  onQuienRetira: (v: string) => void
  onDniRetira: (v: string) => void
  onObservaciones: (v: string) => void
  onCancelar: () => void
  onConfirmar: () => void
}): JSX.Element {
  const yaNoEstaEnStock = paquete.estado !== 'EN_STOCK'

  return (
    <div className="ficha">
      <div className="ficha__cabecera">
        <div>
          <div className="ficha__codigo">{paquete.codigo_tracking}</div>
          <div style={{ color: '#56657a', fontSize: 13 }}>
            Ingresó el {formatearFechaHora(paquete.fecha_ingreso)}
          </div>
        </div>
        <EtiquetaVencimiento paquete={paquete} diasAviso={diasAviso} />
      </div>

      <div className="ficha__cuerpo">
        {yaNoEstaEnStock && (
          <Aviso tipo="error">
            Este paquete ya no está en stock
            {paquete.retirado_por_nombre ? `: lo retiró ${paquete.retirado_por_nombre}` : ''}
            {paquete.fecha_egreso ? ` el ${formatearFechaHora(paquete.fecha_egreso)}` : ''}.
          </Aviso>
        )}

        {/* La ubicacion va primera y grande: es lo que el empleado necesita
            saber antes de ir a buscar el paquete. */}
        {usarUbicaciones && (
          <div className="ficha__ubicacion">
            <div>
              <div className="ficha__ubicacion-texto">Buscar en</div>
              <div className="ficha__ubicacion-valor">{paquete.ubicacion ?? 'Sin ubicar'}</div>
            </div>
          </div>
        )}

        <div className="datos">
          <div>
            <div className="dato__etiqueta">Destinatario</div>
            <div className="dato__valor">{paquete.destinatario_nombre ?? '—'}</div>
          </div>
          <div>
            <div className="dato__etiqueta">DNI</div>
            <div className="dato__valor">{paquete.destinatario_dni ?? '—'}</div>
          </div>
          <div>
            <div className="dato__etiqueta">Teléfono</div>
            <div className="dato__valor">{paquete.destinatario_telefono ?? '—'}</div>
          </div>
          <div>
            <div className="dato__etiqueta">Código de retiro</div>
            <div className="dato__valor">{paquete.codigo_retiro ?? '—'}</div>
          </div>
          <div>
            <div className="dato__etiqueta">Fecha límite</div>
            <div className="dato__valor">{formatearFecha(paquete.fecha_limite)}</div>
          </div>
        </div>

        {paquete.observaciones && <Aviso tipo="info">Observaciones: {paquete.observaciones}</Aviso>}

        {!yaNoEstaEnStock && (
          <>
            <h2 className="panel__titulo" style={{ marginTop: 8 }}>
              Quién se lo lleva
            </h2>
            <div className="grilla grilla--2" style={{ marginBottom: 16 }}>
              <label className="campo">
                <span>Nombre de quien retira</span>
                <input
                  type="text"
                  value={quienRetira}
                  onChange={(e) => onQuienRetira(e.target.value)}
                  placeholder="Nombre y apellido"
                  autoFocus
                />
                <span className="campo__ayuda">
                  Ya viene con el destinatario. Cambialo solo si vino a buscarlo otra persona.
                </span>
              </label>
              <label className="campo">
                <span>DNI de quien retira</span>
                <input
                  type="text"
                  value={dniRetira}
                  onChange={(e) => onDniRetira(e.target.value)}
                  placeholder="Sin puntos"
                />
              </label>
            </div>

            <label className="campo" style={{ marginBottom: 18 }}>
              <span>Observaciones (opcional)</span>
              <textarea
                value={observaciones}
                onChange={(e) => onObservaciones(e.target.value)}
                placeholder="Por ejemplo: retiró un familiar autorizado"
              />
            </label>
          </>
        )}

        <div className="acciones">
          {!yaNoEstaEnStock && (
            <button
              className="boton boton--exito boton--grande"
              onClick={onConfirmar}
              disabled={entregando}
            >
              {entregando ? 'Registrando…' : 'Entregar paquete'}
            </button>
          )}
          <button className="boton boton--neutro boton--grande" onClick={onCancelar}>
            {yaNoEstaEnStock ? 'Volver a buscar' : 'Cancelar'}
          </button>
        </div>
      </div>
    </div>
  )
}
