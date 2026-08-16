/*
 * Configuracion: plazo, datos del local, operadores y copias de seguridad.
 *
 * El plazo de retiro lo define Mercado Libre y puede cambiar, asi que el dueno
 * lo ajusta desde acá sin que nadie toque codigo.
 */

import { useEffect, useState } from 'react'
import { useApp } from '../contexto'
import { Aviso, Vacio, formatearFecha, type TipoAviso } from '../componentes/Comunes'
import { hoy } from '@shared/fechas'
import type { EstadoRespaldo, Operador, RolOperador } from '@shared/types'

// Se llama `ConfiguracionPagina` y no `Configuracion` para no chocar con el
// tipo del mismo nombre que viene de `@shared/types`.
export function ConfiguracionPagina(): JSX.Element {
  const { config, refrescar } = useApp()
  const [nombreLocal, setNombreLocal] = useState(config.nombre_local)
  const [diasPlazo, setDiasPlazo] = useState(String(config.dias_plazo_default))
  const [diasAviso, setDiasAviso] = useState(String(config.dias_aviso_vencimiento))
  const [usarUbicaciones, setUsarUbicaciones] = useState(config.usar_ubicaciones)
  const [ubicaciones, setUbicaciones] = useState(config.ubicaciones.join(', '))
  const [carpetaRespaldo, setCarpetaRespaldo] = useState(config.carpeta_respaldo)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: TipoAviso; texto: string } | null>(null)
  const [rutaBase, setRutaBase] = useState('')
  const [estado, setEstado] = useState<EstadoRespaldo | null>(null)

  async function cargarEstado(): Promise<void> {
    try {
      setEstado(await window.api.configuracion.estadoRespaldo())
    } catch {
      setEstado(null)
    }
  }

  useEffect(() => {
    void window.api.configuracion
      .rutaBase()
      .then(setRutaBase)
      .catch(() => undefined)
    void cargarEstado()
  }, [])

  async function elegirCarpeta(): Promise<void> {
    try {
      const elegida = await window.api.configuracion.elegirCarpeta()
      if (elegida) setCarpetaRespaldo(elegida)
    } catch (err) {
      setMensaje({
        tipo: 'error',
        texto: err instanceof Error ? err.message : 'No se pudo abrir el selector de carpetas.'
      })
    }
  }

  async function guardar(): Promise<void> {
    setGuardando(true)
    setMensaje(null)
    try {
      await window.api.configuracion.guardar({
        nombre_local: nombreLocal,
        dias_plazo_default: Number(diasPlazo) || 0,
        dias_aviso_vencimiento: Number(diasAviso) || 0,
        usar_ubicaciones: usarUbicaciones,
        ubicaciones: ubicaciones
          .split(',')
          .map((u) => u.trim())
          .filter(Boolean),
        carpeta_respaldo: carpetaRespaldo
      })
      await refrescar()
      await cargarEstado()
      setMensaje({ tipo: 'ok', texto: 'Configuración guardada.' })
    } catch (err) {
      setMensaje({
        tipo: 'error',
        texto: err instanceof Error ? err.message : 'No se pudo guardar la configuración.'
      })
    } finally {
      setGuardando(false)
    }
  }

  async function exportar(): Promise<void> {
    try {
      const ruta = await window.api.configuracion.exportarCopia()
      if (ruta) setMensaje({ tipo: 'ok', texto: `Copia guardada en ${ruta}` })
    } catch (err) {
      setMensaje({
        tipo: 'error',
        texto: err instanceof Error ? err.message : 'No se pudo guardar la copia.'
      })
    }
  }

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Configuración</h1>
          <p>Ajustes del local, operadores y copias de seguridad.</p>
        </div>
      </div>

      {mensaje && <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>}

      <div className="panel">
        <h2 className="panel__titulo">Plazo de retiro</h2>
        <div className="grilla grilla--2" style={{ marginBottom: 14 }}>
          <label className="campo">
            <span>Días de plazo por defecto</span>
            <input
              type="number"
              min={0}
              value={diasPlazo}
              onChange={(e) => setDiasPlazo(e.target.value)}
            />
            <span className="campo__ayuda">
              Con este número se calcula la fecha límite sugerida al recibir un paquete. Como el
              plazo real lo define Mercado Libre, en la recepción se puede cambiar paquete por
              paquete.
            </span>
          </label>
          <label className="campo">
            <span>Avisar cuántos días antes de vencer</span>
            <input
              type="number"
              min={0}
              value={diasAviso}
              onChange={(e) => setDiasAviso(e.target.value)}
            />
            <span className="campo__ayuda">
              Los paquetes que vencen dentro de este plazo aparecen en amarillo.
            </span>
          </label>
        </div>
      </div>

      <div className="panel">
        <h2 className="panel__titulo">Datos del local</h2>
        <div className="grilla grilla--2" style={{ marginBottom: 16 }}>
          <label className="campo">
            <span>Nombre del local</span>
            <input
              type="text"
              value={nombreLocal}
              onChange={(e) => setNombreLocal(e.target.value)}
            />
          </label>
        </div>

        {/* El local que apila en el piso apaga esto y desaparecen el campo, la
            columna y el aviso de "sin ubicación", que si no marcaria un problema
            inexistente en todos los paquetes. */}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={usarUbicaciones}
            onChange={(e) => setUsarUbicaciones(e.target.checked)}
            style={{ width: 18, height: 18, marginTop: 2 }}
          />
          <span>
            <strong>Guardamos los paquetes en estantes identificados</strong>
            <span className="campo__ayuda" style={{ display: 'block' }}>
              Si los apilan sin un lugar fijo, destildá esta opción: desaparece el campo de
              ubicación de todas las pantallas y deja de avisar que faltan ubicaciones.
            </span>
          </span>
        </label>

        {usarUbicaciones && (
          <label className="campo" style={{ marginTop: 14, maxWidth: 420 }}>
            <span>Ubicaciones del depósito</span>
            <input
              type="text"
              value={ubicaciones}
              onChange={(e) => setUbicaciones(e.target.value)}
              placeholder="A-1, A-2, B-1"
            />
            <span className="campo__ayuda">
              Separadas por coma. Aparecen como sugerencia al recibir paquetes.
            </span>
          </label>
        )}
      </div>

      <div className="acciones" style={{ marginBottom: 22 }}>
        <button
          className="boton boton--primario boton--grande"
          onClick={() => void guardar()}
          disabled={guardando}
        >
          {guardando ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </div>

      <Operadores onCambio={refrescar} />

      <div className="panel">
        <h2 className="panel__titulo">Copia de seguridad</h2>
        <p style={{ marginTop: 0, color: '#56657a' }}>
          La aplicación guarda una copia automática por día, y conserva las últimas 30.
        </p>

        <div style={{ marginBottom: 14 }}>
          <div className="dato__etiqueta">Los datos se guardan en</div>
          <div style={{ fontFamily: 'Consolas, monospace', fontSize: 13 }}>{rutaBase || '—'}</div>
        </div>

        <label className="campo" style={{ marginBottom: 6, maxWidth: 560 }}>
          <span>Segunda carpeta para la copia diaria</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={carpetaRespaldo}
              onChange={(e) => setCarpetaRespaldo(e.target.value)}
              placeholder="Por ejemplo: E:\respaldo-punto-retiro"
              style={{ flex: 1 }}
            />
            <button className="boton boton--neutro" onClick={() => void elegirCarpeta()}>
              Elegir…
            </button>
          </div>
          <span className="campo__ayuda">
            Un pendrive que quede siempre enchufado, o una carpeta de red. La copia diaria se guarda
            también ahí, así un problema en el disco de esta computadora no se lleva los datos y los
            respaldos juntos. Si el pendrive no está conectado, la copia local se hace igual.
          </span>
        </label>

        {estado && <EstadoDeRespaldo estado={estado} />}

        <button
          className="boton boton--neutro"
          onClick={() => void exportar()}
          style={{ marginTop: 14 }}
        >
          Guardar copia ahora en otra carpeta
        </button>
      </div>
    </>
  )
}

/** Que el dueño pueda ver si las copias se estan haciendo, sin buscar carpetas. */
function EstadoDeRespaldo({ estado }: { estado: EstadoRespaldo }): JSX.Element {
  if (!estado.ultima_copia) {
    return (
      <Aviso tipo="info">
        Todavía no se hizo ninguna copia automática. La primera se genera unos segundos después de
        abrir la aplicación.
      </Aviso>
    )
  }

  const esDeHoy = estado.ultima_copia === hoy()
  const cuando = esDeHoy ? 'hoy' : `el ${formatearFecha(estado.ultima_copia)}`

  if (!estado.carpeta_externa) {
    return (
      <Aviso tipo="alerta">
        Última copia {cuando}. Hay {estado.copias_locales} guardadas, pero todas en este mismo
        disco: elegí una segunda carpeta para que no dependan de esta computadora.
      </Aviso>
    )
  }

  if (!estado.externa_disponible) {
    return (
      <Aviso tipo="error">
        Última copia {cuando}, pero la carpeta {estado.carpeta_externa} no está disponible. Si es un
        pendrive, conectalo: hasta entonces las copias quedan solo en este disco.
      </Aviso>
    )
  }

  if (!estado.externa_al_dia) {
    return (
      <Aviso tipo="alerta">
        Última copia {cuando}, pero todavía no se duplicó en {estado.carpeta_externa}. Se copia sola
        la próxima vez que abras la aplicación.
      </Aviso>
    )
  }

  return (
    <Aviso tipo="ok">
      Última copia {cuando}, guardada acá y también en {estado.carpeta_externa}.
    </Aviso>
  )
}

function Operadores({ onCambio }: { onCambio: () => Promise<void> }): JSX.Element {
  const [lista, setLista] = useState<Operador[]>([])
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState<RolOperador>('operador')
  const [error, setError] = useState<string | null>(null)

  async function cargar(): Promise<void> {
    try {
      setLista(await window.api.operadores.listar(false))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los operadores.')
    }
  }

  useEffect(() => {
    void cargar()
  }, [])

  async function agregar(): Promise<void> {
    if (!nombre.trim()) return
    try {
      await window.api.operadores.crear(nombre, rol)
      setNombre('')
      await cargar()
      await onCambio()
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar el operador.')
    }
  }

  async function alternarActivo(operador: Operador): Promise<void> {
    try {
      await window.api.operadores.actualizar(operador.id, { activo: !operador.activo })
      await cargar()
      await onCambio()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el operador.')
    }
  }

  return (
    <div className="panel">
      <h2 className="panel__titulo">Operadores</h2>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <p style={{ marginTop: 0, color: '#56657a' }}>
        Quedan registrados en cada paquete que reciben y entregan. No se borran: se desactivan, para
        no perder el historial de lo que ya hicieron.
      </p>

      <div className="filtros">
        <label className="campo campo--ancho">
          <span>Nombre</span>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre del empleado"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void agregar()
            }}
          />
        </label>
        <label className="campo">
          <span>Rol</span>
          <select value={rol} onChange={(e) => setRol(e.target.value as RolOperador)}>
            <option value="operador">Operador</option>
            <option value="admin">Encargado</option>
          </select>
        </label>
        <button className="boton boton--primario" onClick={() => void agregar()}>
          Agregar operador
        </button>
      </div>

      {lista.length === 0 ? (
        <Vacio titulo="No hay operadores cargados" />
      ) : (
        <div className="tabla-envoltorio">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lista.map((o) => (
                <tr key={o.id}>
                  <td>{o.nombre}</td>
                  <td>{o.rol === 'admin' ? 'Encargado' : 'Operador'}</td>
                  <td>
                    <span className={`etiqueta etiqueta--${o.activo ? 'ok' : 'neutra'}`}>
                      {o.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="fila-acciones">
                    <button className="boton-mini" onClick={() => void alternarActivo(o)}>
                      {o.activo ? 'Desactivar' : 'Reactivar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
