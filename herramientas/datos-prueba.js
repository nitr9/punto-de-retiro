/**
 * Carga paquetes de prueba para poder recorrer la aplicacion sin esperar a que
 * llegue mercaderia real.
 *
 *   npm run datos-prueba     -> carga los paquetes de ejemplo
 *   npm run borrar-prueba    -> los borra todos
 *
 * Todos los codigos empiezan con DEMO-, asi el borrado nunca toca un paquete
 * real cargado por el local.
 */
const path = require('path')
const Database = require(path.join(__dirname, '..', 'node_modules', 'better-sqlite3'))

const PREFIJO = 'DEMO-'
const rutaBase = path.join(process.env.APPDATA, 'punto-retiro', 'datos', 'punto-retiro.db')

function dosDigitos(n) {
  return n < 10 ? `0${n}` : String(n)
}

function fechaRelativa(dias) {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`
}

function momentoRelativo(dias, hora = 10) {
  return `${fechaRelativa(dias)} ${dosDigitos(hora)}:${dosDigitos(15)}:00`
}

// Paquetes pensados para que se vea cada situacion posible en pantalla:
// vencidos en rojo, por vencer en amarillo, con tiempo en verde, sin ubicar,
// con observaciones, ya entregados y devueltos.
const EJEMPLOS = [
  // Vencidos: tendrian que haberse devuelto a Mercado Libre.
  { nombre: 'Marcela Ibáñez', dni: '27458113', tel: '3517412298', ubic: 'A-1', ingreso: -9, limite: -4 },
  { nombre: 'Rubén Cabrera', dni: '20114937', tel: '3512298431', ubic: 'A-1', ingreso: -8, limite: -3 },
  { nombre: 'Sofía Paredes', dni: '41028776', tel: '3513347719', ubic: 'B-2', ingreso: -7, limite: -2,
    obs: 'Caja golpeada en una esquina' },

  // Vencen hoy o manana: hay que avisarle al cliente.
  { nombre: 'Gustavo Miranda', dni: '33097215', tel: '3516628840', ubic: 'A-2', ingreso: -4, limite: 0 },
  { nombre: 'Carla Figueroa', dni: '38442091', tel: '3514417726', ubic: 'A-2', ingreso: -3, limite: 0 },
  { nombre: 'Damián Rossi', dni: '29883104', tel: '3518819043', ubic: 'B-1', ingreso: -3, limite: 1 },
  { nombre: 'Lucía Ferreyra', dni: '44127350', tel: '3512204468', ubic: 'B-1', ingreso: -2, limite: 1 },

  // Con tiempo de sobra.
  { nombre: 'Hernán Quiroga', dni: '31556802', tel: '3517738851', ubic: 'A-3', ingreso: -1, limite: 2 },
  { nombre: 'Valeria Ojeda', dni: '36219477', tel: '3515590124', ubic: 'A-3', ingreso: -1, limite: 3 },
  { nombre: 'Nicolás Bustos', dni: '40773165', tel: '3513048892', ubic: 'B-3', ingreso: 0, limite: 3 },
  { nombre: 'Patricia Alaniz', dni: '24660918', tel: '3516172735', ubic: 'B-3', ingreso: 0, limite: 3 },
  { nombre: 'Emiliano Vega', dni: '35012784', tel: '3514883360', ubic: 'A-1', ingreso: 0, limite: 4,
    obs: 'Paquete muy pesado, está en el piso' },

  // Sin ubicacion cargada: aparecen marcados en amarillo en el listado.
  { nombre: 'Rocío Maldonado', dni: '42985613', tel: '3512761190', ubic: null, ingreso: 0, limite: 3 },
  { nombre: 'Fernando Luna', dni: '28374501', tel: '3519934287', ubic: null, ingreso: 0, limite: 3 },

  // Sin datos del destinatario: solo se sabe el codigo, como pasa al recibir rapido.
  { nombre: null, dni: null, tel: null, ubic: 'A-2', ingreso: 0, limite: 3 },
  { nombre: null, dni: null, tel: null, ubic: 'A-2', ingreso: 0, limite: 3 }
]

const ENTREGADOS = [
  { nombre: 'Andrea Sosa', dni: '30447192', ubic: 'A-1', ingreso: -6, limite: -1, retiro: -5 },
  { nombre: 'Matías Herrera', dni: '37881256', ubic: 'B-2', ingreso: -5, limite: 0, retiro: -4 },
  { nombre: 'Julieta Ramos', dni: '39220847', ubic: 'A-3', ingreso: -3, limite: 2, retiro: -1,
    tercero: 'Marcos Ramos (hermano)' },
  { nombre: 'Leandro Ponce', dni: '26109553', ubic: 'B-1', ingreso: -2, limite: 3, retiro: 0 }
]

const DEVUELTOS = [
  { nombre: 'Silvana Coria', dni: '25778340', ubic: 'B-3', ingreso: -14, limite: -9, salida: -8 },
  { nombre: 'Ariel Godoy', dni: '32665019', ubic: 'B-3', ingreso: -13, limite: -8, salida: -8 }
]

function codigo(indice) {
  return `${PREFIJO}${String(100000000 + indice * 7919).slice(0, 9)}`
}

function borrar(db) {
  const info = db.prepare(`SELECT id FROM paquetes WHERE codigo_tracking LIKE '${PREFIJO}%'`).all()
  const ids = info.map((f) => f.id)
  const borrarTodo = db.transaction(() => {
    for (const id of ids) db.prepare('DELETE FROM movimientos WHERE paquete_id = ?').run(id)
    db.prepare(`DELETE FROM paquetes WHERE codigo_tracking LIKE '${PREFIJO}%'`).run()
    db.prepare(`DELETE FROM lotes WHERE remito = 'DEMO'`).run()
  })
  borrarTodo()
  return ids.length
}

function cargar(db) {
  const operador = db.prepare('SELECT id FROM operadores WHERE activo = 1 ORDER BY id LIMIT 1').get()
  const operadorId = operador ? operador.id : null

  const lote = db
    .prepare(
      `INSERT INTO lotes (fecha, transportista, remito, cantidad_declarada, estado, operador_id, cerrado_en)
       VALUES (?, 'Transporte de prueba', 'DEMO', ?, 'CERRADO', ?, ?)`
    )
    .run(fechaRelativa(0), EJEMPLOS.length, operadorId, momentoRelativo(0, 9))
  const loteId = Number(lote.lastInsertRowid)

  const insertar = db.prepare(
    `INSERT INTO paquetes (
       codigo_tracking, codigo_retiro, destinatario_nombre, destinatario_dni, destinatario_telefono,
       estado, ubicacion, fecha_ingreso, fecha_limite, fecha_egreso, lote_id,
       operador_ingreso_id, operador_egreso_id, retirado_por_nombre, retirado_por_dni, observaciones
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const movimiento = db.prepare(
    'INSERT INTO movimientos (paquete_id, tipo, fecha, operador_id, detalle) VALUES (?, ?, ?, ?, ?)'
  )

  let indice = 0
  const todo = db.transaction(() => {
    for (const p of EJEMPLOS) {
      const cod = codigo(indice++)
      const r = insertar.run(
        cod, cod.replace(PREFIJO, 'RET'), p.nombre, p.dni, p.tel,
        'EN_STOCK', p.ubic, momentoRelativo(p.ingreso), fechaRelativa(p.limite),
        null, loteId, operadorId, null, null, null, p.obs || null
      )
      movimiento.run(Number(r.lastInsertRowid), 'INGRESO', momentoRelativo(p.ingreso), operadorId, `Ingreso de ${cod}`)
    }

    for (const p of ENTREGADOS) {
      const cod = codigo(indice++)
      const quien = p.tercero || p.nombre
      const r = insertar.run(
        cod, cod.replace(PREFIJO, 'RET'), p.nombre, p.dni, null,
        'ENTREGADO', p.ubic, momentoRelativo(p.ingreso), fechaRelativa(p.limite),
        momentoRelativo(p.retiro, 16), loteId, operadorId, operadorId, quien, p.dni, null
      )
      const id = Number(r.lastInsertRowid)
      movimiento.run(id, 'INGRESO', momentoRelativo(p.ingreso), operadorId, `Ingreso de ${cod}`)
      movimiento.run(id, 'ENTREGA', momentoRelativo(p.retiro, 16), operadorId, `Retiró ${quien}`)
    }

    for (const p of DEVUELTOS) {
      const cod = codigo(indice++)
      const r = insertar.run(
        cod, cod.replace(PREFIJO, 'RET'), p.nombre, p.dni, null,
        'DEVUELTO', p.ubic, momentoRelativo(p.ingreso), fechaRelativa(p.limite),
        momentoRelativo(p.salida, 18), loteId, operadorId, operadorId, null, null, null
      )
      const id = Number(r.lastInsertRowid)
      movimiento.run(id, 'INGRESO', momentoRelativo(p.ingreso), operadorId, `Ingreso de ${cod}`)
      movimiento.run(id, 'DEVOLUCION', momentoRelativo(p.salida, 18), operadorId, 'Devuelto a Mercado Libre')
    }
  })

  todo()
  return indice
}

const db = new Database(rutaBase)
const borrarSolamente = process.argv.includes('--borrar')

const eliminados = borrar(db)
if (borrarSolamente) {
  console.log(`Se borraron ${eliminados} paquetes de prueba.`)
} else {
  const cargados = cargar(db)
  console.log(`Se cargaron ${cargados} paquetes de prueba (se borraron ${eliminados} anteriores).`)
}
db.close()
