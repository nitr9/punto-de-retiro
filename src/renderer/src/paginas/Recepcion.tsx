/*
 * Recibir paquetes.
 *
 * Es la pantalla mas sensible del sistema: cada paquete ya se carga una vez en
 * la app de Mercado Libre, asi que si cargarlo acá cuesta trabajo, se lo saltean
 * y el registro queda incompleto. Por eso escanear tiene que costar un segundo:
 * el foco no se va del campo, la ubicacion y la fecha quedan fijas entre
 * paquetes, y no hay nada que confirmar.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useApp } from '../contexto'
import {
  Aviso,
  Ubicacion,
  Vacio,
  formatearFecha,
  type TipoAviso
} from '../componentes/Comunes'
import { hoy, sumarDias } from '@shared/fechas'
import type { Lote, PaqueteDetallado } from '@shared/types'

export function Recepcion(): JSX.Element {
  const { config, operadorId, refrescar } = useApp()
  const [lote, setLote] = useState<Lote | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        setLote(await window.api.lotes.abierto())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo abrir la recepción.')
      } finally {
        setCargando(false)
      }
    })()
  }, [])

  async function abrirLote(datos: {
    transportista: string
    remito: string
    cantidad_declarada: string
  }): Promise<void> {
    try {
      const nuevo = await window.api.lotes.crear({
        transportista: datos.transportista,
        remito: datos.remito,
        cantidad_declarada: datos.cantidad_declarada ? Number(datos.cantidad_declarada) : null,
        operador_id: operadorId
      })
      setLote(nuevo)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir la recepción.')
    }
  }

  async function cerrarLote(): Promise<void> {
    if (!lote) return
    try {
      await window.api.lotes.cerrar(lote.id)
      setLote(null)
      await refrescar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cerrar la recepción.')
    }
  }

  if (cargando) return <div style={{ color: '#56657a' }}>Cargando…</div>

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Recibir paquetes</h1>
          <p>
            {lote
              ? 'Escaneá los paquetes uno atrás de otro. El cursor vuelve solo al campo.'
              : 'Abrí una recepción para empezar a descargar el camión.'}
          </p>
        </div>
        {lote && (
          <button className="boton boton--neutro" onClick={() => void cerrarLote()}>
            Cerrar recepción
          </button>
        )}
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {/* Nada cierra los lotes solos, y el boton "Cerrar recepción" es facil de
          olvidar. Si el lote quedo abierto de otro dia, los paquetes de hoy se
          suman a esa tanda y la comparacion contra el remito —que es lo unico
          que detecta faltantes— queda mezclando dos dias. */}
      {lote && lote.fecha !== hoy() && (
        <Aviso tipo="alerta">
          Esta recepción quedó abierta del {formatearFecha(lote.fecha)} y ya lleva{' '}
          {lote.cantidad_escaneada} paquete{lote.cantidad_escaneada === 1 ? '' : 's'}. Si hoy llegó
          mercadería nueva, cerrala y abrí una para que la cuenta contra el remito dé bien.{' '}
          <button
            className="boton-mini boton-mini--primario"
            onClick={() => void cerrarLote()}
            style={{ marginLeft: 4 }}
          >
            Cerrar y empezar una nueva
          </button>
        </Aviso>
      )}

      {!lote ? (
        <FormularioLote onAbrir={abrirLote} />
      ) : (
        <Escaneo
          lote={lote}
          diasPlazo={config.dias_plazo_default}
          usarUbicaciones={config.usar_ubicaciones}
          ubicaciones={config.ubicaciones}
          operadorId={operadorId}
          onCambio={async () => {
            setLote(await window.api.lotes.abierto())
            await refrescar()
          }}
        />
      )}
    </>
  )
}

function FormularioLote({
  onAbrir
}: {
  onAbrir: (datos: {
    transportista: string
    remito: string
    cantidad_declarada: string
  }) => Promise<void>
}): JSX.Element {
  const [transportista, setTransportista] = useState('')
  const [remito, setRemito] = useState('')
  const [cantidad, setCantidad] = useState('')

  return (
    <div className="panel">
      <h2 className="panel__titulo">Nueva recepción</h2>
      <div className="grilla grilla--3" style={{ marginBottom: 16 }}>
        <label className="campo">
          <span>Transportista o chofer</span>
          <input
            type="text"
            value={transportista}
            onChange={(e) => setTransportista(e.target.value)}
            placeholder="Opcional"
          />
        </label>
        <label className="campo">
          <span>Número de remito</span>
          <input
            type="text"
            value={remito}
            onChange={(e) => setRemito(e.target.value)}
            placeholder="Opcional"
          />
        </label>
        <label className="campo">
          <span>Paquetes declarados</span>
          <input
            type="number"
            min={0}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            placeholder="Opcional"
          />
        </label>
      </div>
      <p className="campo__ayuda" style={{ marginBottom: 14 }}>
        Cargar los paquetes declarados permite comparar al final cuántos vinieron contra cuántos
        escaneaste, y detectar faltantes.
      </p>
      <button
        className="boton boton--primario boton--grande"
        onClick={() => void onAbrir({ transportista, remito, cantidad_declarada: cantidad })}
      >
        Empezar a recibir
      </button>
    </div>
  )
}

function Escaneo({
  lote,
  diasPlazo,
  usarUbicaciones,
  ubicaciones,
  operadorId,
  onCambio
}: {
  lote: Lote
  diasPlazo: number
  usarUbicaciones: boolean
  ubicaciones: string[]
  operadorId: number | null
  onCambio: () => Promise<void>
}): JSX.Element {
  // Ubicacion y fecha se mantienen entre paquetes: mientras se descarga un
  // estante son siempre las mismas, y volver a cargarlas en cada uno es el tipo
  // de friccion que hace que dejen de usar la app.
  const [ubicacion, setUbicacion] = useState('')
  const [fechaLimite, setFechaLimite] = useState(() => sumarDias(hoy(), diasPlazo))

  // Sobre que dia se calculo la sugerencia. En el local la app se abre a la
  // mañana y queda abierta: sin esto, si alguien deja Recepción abierta y al
  // otro dia descarga un camion, todos los paquetes entran con la fecha limite
  // de ayer y aparecen vencidos un dia antes.
  const sugeridaPara = useRef(hoy())

  const [codigo, setCodigo] = useState('')
  const [destinatario, setDestinatario] = useState('')
  const [telefono, setTelefono] = useState('')
  const [dni, setDni] = useState('')
  const [observaciones, setObservaciones] = useState('')

  const [recientes, setRecientes] = useState<PaqueteDetallado[]>([])
  const [aviso, setAviso] = useState<{ tipo: TipoAviso; texto: string } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const inputCodigo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputCodigo.current?.focus()
  }, [])

  /**
   * Pone la fecha al dia si cambio la jornada, respetando lo que el operador
   * haya escrito a mano: solo la pisa si sigue siendo la sugerencia de ayer.
   */
  function fechaLimiteVigente(): string {
    const fechaHoy = hoy()
    if (fechaHoy === sugeridaPara.current) return fechaLimite

    const eraLaSugerencia = fechaLimite === sumarDias(sugeridaPara.current, diasPlazo)
    sugeridaPara.current = fechaHoy
    if (!eraLaSugerencia) return fechaLimite

    const nueva = sumarDias(fechaHoy, diasPlazo)
    setFechaLimite(nueva)
    return nueva
  }

  async function registrar(e: FormEvent): Promise<void> {
    e.preventDefault()
    const limpio = codigo.trim()
    if (!limpio || guardando) return

    setGuardando(true)
    try {
      const resultado = await window.api.paquetes.ingresar({
        codigo_tracking: limpio,
        destinatario_nombre: destinatario,
        destinatario_dni: dni,
        destinatario_telefono: telefono,
        ubicacion,
        fecha_limite: fechaLimiteVigente(),
        observaciones,
        lote_id: lote.id,
        operador_id: operadorId
      })

      if (resultado.ok) {
        const detallado = await window.api.paquetes.porId(resultado.paquete.id)
        if (detallado) setRecientes((prev) => [detallado, ...prev].slice(0, 60))
        setAviso({ tipo: 'ok', texto: `${limpio} guardado en ${ubicacion || 'sin ubicación'}.` })
        setCodigo('')
        setDestinatario('')
        setTelefono('')
        setDni('')
        setObservaciones('')
        await onCambio()
      } else if (resultado.motivo === 'DUPLICADO') {
        // Avisa donde esta el que ya estaba, que es lo que hace falta saber, y
        // deja seguir escaneando en vez de cortar con un error.
        setAviso({
          tipo: 'alerta',
          texto: `${limpio} ya está en stock desde antes, en ${
            resultado.paquete.ubicacion ?? 'una ubicación sin cargar'
          }. No se agregó de nuevo.`
        })
        setCodigo('')
      } else {
        setAviso({ tipo: 'error', texto: resultado.mensaje })
      }
    } catch (err) {
      setAviso({
        tipo: 'error',
        texto: err instanceof Error ? err.message : 'No se pudo guardar el paquete.'
      })
    } finally {
      setGuardando(false)
      inputCodigo.current?.focus()
    }
  }

  const faltantes =
    lote.cantidad_declarada !== null ? lote.cantidad_declarada - lote.cantidad_escaneada : null

  return (
    <>
      <div className="tarjetas">
        <div className="tarjeta tarjeta--info">
          <div className="tarjeta__valor">{lote.cantidad_escaneada}</div>
          <div className="tarjeta__etiqueta">Escaneados en esta recepción</div>
        </div>
        {lote.cantidad_declarada !== null && faltantes !== null && (
          <>
            <div className="tarjeta">
              <div className="tarjeta__valor">{lote.cantidad_declarada}</div>
              <div className="tarjeta__etiqueta">Declarados en el remito</div>
            </div>
            <div
              className={`tarjeta ${
                faltantes === 0 ? 'tarjeta--ok' : faltantes > 0 ? 'tarjeta--alerta' : 'tarjeta--peligro'
              }`}
            >
              <div className="tarjeta__valor">{faltantes}</div>
              <div className="tarjeta__etiqueta">
                {faltantes > 0 ? 'Faltan por escanear' : faltantes === 0 ? 'Coincide' : 'De más'}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="panel">
        <h2 className="panel__titulo">
          {usarUbicaciones ? 'Dónde se están guardando' : 'Plazo de retiro'}
        </h2>
        <div className={usarUbicaciones ? 'grilla grilla--2' : ''} style={{ marginBottom: 6 }}>
          {usarUbicaciones && (
            <label className="campo">
              <span>Ubicación en el depósito</span>
              <input
                type="text"
                list="lista-ubicaciones"
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                placeholder="Por ejemplo: A-1"
              />
              <datalist id="lista-ubicaciones">
                {ubicaciones.map((u) => (
                  <option value={u} key={u} />
                ))}
              </datalist>
              <span className="campo__ayuda">
                Se mantiene entre paquetes. Cambiala cuando pases a otro estante.
              </span>
            </label>
          )}
          <label className="campo">
            <span>Fecha límite de retiro</span>
            <input
              type="date"
              value={fechaLimite}
              onChange={(e) => setFechaLimite(e.target.value)}
            />
            <span className="campo__ayuda">
              Sugerida con el plazo configurado ({diasPlazo} días). Cambiala si Mercado Libre indica
              otra.
            </span>
          </label>
        </div>
      </div>

      <div className="panel">
        <h2 className="panel__titulo">Escanear paquete</h2>
        {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}

        <form onSubmit={(e) => void registrar(e)}>
          {/* Codigo y destinatario van juntos y grandes: son los dos datos que
              cargan en todos los paquetes. El resto queda en segunda fila. */}
          <div className="carga-principal">
            <label className="campo">
              <span>Código del paquete</span>
              <input
                ref={inputCodigo}
                className="input-grande"
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Escaneá o escribí el código"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label className="campo">
              <span>Destinatario</span>
              <input
                className="input-grande"
                type="text"
                value={destinatario}
                onChange={(e) => setDestinatario(e.target.value)}
                placeholder="Nombre y apellido"
                autoComplete="off"
              />
            </label>
            <button className="boton boton--primario boton--grande" disabled={guardando}>
              Agregar
            </button>
          </div>

          <p className="campo__ayuda" style={{ margin: '0 0 14px' }}>
            Con Enter se guarda el paquete y el cursor vuelve al código, listo para el siguiente.
          </p>

          <div className="grilla grilla--3">
            <label className="campo">
              <span>Teléfono (opcional)</span>
              <input
                type="text"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Para poder avisarle"
              />
            </label>
            <label className="campo">
              <span>DNI (opcional)</span>
              <input type="text" value={dni} onChange={(e) => setDni(e.target.value)} />
            </label>
            <label className="campo">
              <span>Observaciones (opcional)</span>
              <input
                type="text"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Caja golpeada, mojado, sin etiqueta…"
              />
            </label>
          </div>
        </form>
      </div>

      <div className="panel">
        <h2 className="panel__titulo">Últimos escaneados</h2>
        {recientes.length === 0 ? (
          <Vacio
            titulo="Todavía no escaneaste ningún paquete"
            detalle="Los que vayas agregando aparecen acá para que puedas revisarlos."
          />
        ) : (
          <div className="recientes">
            {recientes.map((p) => (
              <div className="reciente" key={p.id}>
                <span className="reciente__codigo">{p.codigo_tracking}</span>
                {usarUbicaciones && <Ubicacion valor={p.ubicacion} />}
                <span style={{ color: '#56657a', fontSize: 13, minWidth: 150 }}>
                  {p.destinatario_nombre ?? 'Sin destinatario'}
                </span>
                <span style={{ color: '#56657a', fontSize: 13 }}>
                  vence {formatearFecha(p.fecha_limite)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
