/*
 * Esquema y semillas.
 *
 * El esquema se aplica en cada arranque con `CREATE TABLE IF NOT EXISTS`, asi
 * que abrir una base vieja la deja al dia sin pasos manuales.
 */

import type { Database } from 'better-sqlite3'
import { ahora } from '@shared/fechas'

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS operadores (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre     TEXT    NOT NULL,
  pin        TEXT,
  rol        TEXT    NOT NULL DEFAULT 'operador' CHECK (rol IN ('admin', 'operador')),
  activo     INTEGER NOT NULL DEFAULT 1,
  creado_en  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

-- Cada llegada de mercaderia de Mercado Libre (camion / saca).
CREATE TABLE IF NOT EXISTS lotes (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha              TEXT    NOT NULL,
  transportista      TEXT,
  remito             TEXT,
  cantidad_declarada INTEGER,
  estado             TEXT    NOT NULL DEFAULT 'ABIERTO' CHECK (estado IN ('ABIERTO', 'CERRADO')),
  operador_id        INTEGER REFERENCES operadores(id),
  observaciones      TEXT,
  cerrado_en         TEXT
);

CREATE TABLE IF NOT EXISTS paquetes (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo_tracking       TEXT    NOT NULL,
  codigo_retiro         TEXT,
  destinatario_nombre   TEXT,
  destinatario_dni      TEXT,
  destinatario_telefono TEXT,
  estado                TEXT    NOT NULL DEFAULT 'EN_STOCK'
                                CHECK (estado IN ('EN_STOCK', 'ENTREGADO', 'DEVUELTO', 'INCIDENCIA')),
  ubicacion             TEXT,
  fecha_ingreso         TEXT    NOT NULL,
  -- La fecha limite la define Mercado Libre por paquete: se carga y se edita a mano,
  -- con un valor sugerido a partir del plazo configurado por el dueno del local.
  fecha_limite          TEXT,
  fecha_egreso          TEXT,
  lote_id               INTEGER REFERENCES lotes(id),
  operador_ingreso_id   INTEGER REFERENCES operadores(id),
  operador_egreso_id    INTEGER REFERENCES operadores(id),
  retirado_por_nombre   TEXT,
  retirado_por_dni      TEXT,
  observaciones         TEXT
);

-- Un mismo codigo no puede estar dos veces EN STOCK a la vez, pero si puede
-- repetirse en el historial (por ejemplo si vuelve tras una devolucion).
CREATE UNIQUE INDEX IF NOT EXISTS idx_paquetes_tracking_en_stock
  ON paquetes (codigo_tracking) WHERE estado = 'EN_STOCK';

CREATE INDEX IF NOT EXISTS idx_paquetes_tracking  ON paquetes (codigo_tracking);
CREATE INDEX IF NOT EXISTS idx_paquetes_retiro    ON paquetes (codigo_retiro);
CREATE INDEX IF NOT EXISTS idx_paquetes_dni       ON paquetes (destinatario_dni);
CREATE INDEX IF NOT EXISTS idx_paquetes_nombre    ON paquetes (destinatario_nombre);
CREATE INDEX IF NOT EXISTS idx_paquetes_estado    ON paquetes (estado);
CREATE INDEX IF NOT EXISTS idx_paquetes_limite    ON paquetes (fecha_limite);
CREATE INDEX IF NOT EXISTS idx_paquetes_lote      ON paquetes (lote_id);

-- Bitacora de auditoria: solo se agregan filas, nunca se modifican.
CREATE TABLE IF NOT EXISTS movimientos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  paquete_id  INTEGER NOT NULL REFERENCES paquetes(id),
  tipo        TEXT    NOT NULL,
  fecha       TEXT    NOT NULL,
  operador_id INTEGER REFERENCES operadores(id),
  detalle     TEXT
);

CREATE INDEX IF NOT EXISTS idx_movimientos_paquete ON movimientos (paquete_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha   ON movimientos (fecha);
`

export const CONFIGURACION_POR_DEFECTO: Record<string, string> = {
  // Plazo sugerido en dias. Mercado Libre lo define por paquete, asi que esto es
  // solo el valor con el que se precarga la fecha limite al recibir.
  dias_plazo_default: '3',
  dias_aviso_vencimiento: '1',
  nombre_local: 'Punto de Retiro',
  // Los locales que no guardan por estantes lo apagan desde Configuracion.
  usar_ubicaciones: '1',
  ubicaciones: JSON.stringify(['A-1', 'A-2', 'A-3', 'B-1', 'B-2', 'B-3']),
  // Vacia hasta que el dueno elija un pendrive o una carpeta de red.
  carpeta_respaldo: ''
}

/**
 * Deja la base usable en el primer arranque: valores por defecto y un operador
 * "Mostrador", para que se pueda recibir un paquete sin pasar por Configuracion.
 */
export function sembrarDatosIniciales(db: Database): void {
  const insertarConfig = db.prepare(
    'INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)'
  )

  const sembrar = db.transaction(() => {
    for (const [clave, valor] of Object.entries(CONFIGURACION_POR_DEFECTO)) {
      insertarConfig.run(clave, valor)
    }

    const { total } = db.prepare('SELECT COUNT(*) AS total FROM operadores').get() as {
      total: number
    }
    if (total === 0) {
      db.prepare(
        `INSERT INTO operadores (nombre, rol, activo, creado_en) VALUES (?, 'admin', 1, ?)`
      ).run('Mostrador', ahora())
    }
  })

  sembrar()
}
