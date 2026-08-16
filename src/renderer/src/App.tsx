/*
 * Armazon: panel lateral, navegacion y el estado que comparten las pantallas.
 *
 * Las cuatro pantallas se cambian con F1 a F4, sin tocar el mouse. Entregar es
 * la primera porque es lo que mas se usa: por cada camion que llega hay decenas
 * de clientes que vienen a retirar.
 */

import { useCallback, useEffect, useState } from 'react'
import { ContextoApp } from './contexto'
import { Aviso } from './componentes/Comunes'
import { Entrega } from './paginas/Entrega'
import { Recepcion } from './paginas/Recepcion'
import { Stock } from './paginas/Stock'
import { ConfiguracionPagina } from './paginas/Configuracion'
import type { Configuracion, Operador, ResumenStock } from '@shared/types'

type IdPagina = 'entrega' | 'recepcion' | 'stock' | 'configuracion'

const PAGINAS: { id: IdPagina; titulo: string; atajo: string }[] = [
  { id: 'entrega', titulo: 'Entregar paquete', atajo: 'F1' },
  { id: 'recepcion', titulo: 'Recibir paquetes', atajo: 'F2' },
  { id: 'stock', titulo: 'Paquetes en stock', atajo: 'F3' },
  { id: 'configuracion', titulo: 'Configuración', atajo: 'F4' }
]

const RESUMEN_VACIO: ResumenStock = {
  en_stock: 0,
  vencidos: 0,
  por_vencer: 0,
  sin_ubicacion: 0,
  ingresados_hoy: 0,
  entregados_hoy: 0
}

const CLAVE_OPERADOR = 'punto-retiro:operador'

export default function App(): JSX.Element {
  const [pagina, setPagina] = useState<IdPagina>('entrega')
  const [config, setConfig] = useState<Configuracion | null>(null)
  const [operadores, setOperadores] = useState<Operador[]>([])
  const [operadorId, setOperadorId] = useState<number | null>(null)
  const [resumen, setResumen] = useState<ResumenStock>(RESUMEN_VACIO)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  const refrescar = useCallback(async () => {
    try {
      const [nuevaConfig, listaOperadores, nuevoResumen] = await Promise.all([
        window.api.configuracion.obtener(),
        window.api.operadores.listar(true),
        window.api.paquetes.resumen()
      ])
      setConfig(nuevaConfig)
      setOperadores(listaOperadores)
      setResumen(nuevoResumen)
      setErrorCarga(null)

      // Quien atiende se recuerda entre sesiones: en el local es siempre el
      // mismo turno, y volver a elegirlo cada mañana es un paso al pedo.
      setOperadorId((actual) => {
        if (actual && listaOperadores.some((o) => o.id === actual)) return actual
        const guardado = Number(localStorage.getItem(CLAVE_OPERADOR))
        if (guardado && listaOperadores.some((o) => o.id === guardado)) return guardado
        return listaOperadores[0]?.id ?? null
      })
    } catch (error) {
      setErrorCarga(error instanceof Error ? error.message : 'No se pudo cargar la información.')
    }
  }, [])

  useEffect(() => {
    void refrescar()
  }, [refrescar])

  const cambiarOperador = useCallback((id: number | null) => {
    setOperadorId(id)
    if (id) localStorage.setItem(CLAVE_OPERADOR, String(id))
  }, [])

  useEffect(() => {
    function alPresionar(e: KeyboardEvent): void {
      const indice = ['F1', 'F2', 'F3', 'F4'].indexOf(e.key)
      if (indice === -1) return
      e.preventDefault()
      setPagina(PAGINAS[indice].id)
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [])

  if (errorCarga) {
    return (
      <div style={{ padding: 40 }}>
        <Aviso tipo="error">{errorCarga}</Aviso>
        <button className="boton boton--primario" onClick={() => void refrescar()}>
          Reintentar
        </button>
      </div>
    )
  }

  // La base se abre en la primera consulta, asi que este cartel es lo que se ve
  // mientras tanto: la ventana ya esta visible, no parece colgada.
  if (!config) {
    return <div style={{ padding: 40, color: '#56657a' }}>Abriendo la base de datos…</div>
  }

  const contenido = {
    entrega: <Entrega />,
    recepcion: <Recepcion />,
    stock: <Stock />,
    configuracion: <ConfiguracionPagina />
  }[pagina]

  const pendientesDeDevolver = resumen.vencidos

  return (
    <ContextoApp.Provider
      value={{ config, operadores, operadorId, cambiarOperador, resumen, refrescar }}
    >
      <div className="app">
        <nav className="lateral">
          <div className="lateral__marca">{config.nombre_local}</div>
          <div className="lateral__sub">{resumen.en_stock} paquetes esperando retiro</div>

          {PAGINAS.map((p) => (
            <button
              key={p.id}
              className={`nav-item ${pagina === p.id ? 'nav-item--activo' : ''}`}
              onClick={() => setPagina(p.id)}
            >
              <span>{p.titulo}</span>
              {/* Si hay vencidos, el contador reemplaza al atajo: es lo que hay
                  que ir a mirar. */}
              {p.id === 'stock' && pendientesDeDevolver > 0 ? (
                <span className="nav-item__badge nav-item__badge--alerta">
                  {pendientesDeDevolver}
                </span>
              ) : (
                <span className="atajo">{p.atajo}</span>
              )}
            </button>
          ))}

          <div className="lateral__pie">
            <div className="lateral__etiqueta">Atiende</div>
            <select
              value={operadorId ?? ''}
              onChange={(e) => cambiarOperador(e.target.value ? Number(e.target.value) : null)}
            >
              {operadores.length === 0 && <option value="">Sin operadores</option>}
              {operadores.map((o) => (
                <option value={o.id} key={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </div>
        </nav>

        <main className="contenido">{contenido}</main>
      </div>
    </ContextoApp.Provider>
  )
}
