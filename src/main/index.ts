/*
 * Arranque.
 *
 * Regla: nada que tarde puede correr antes de que la ventana este visible.
 * La ventana se crea primero y la base se abre sola en la primera consulta, que
 * ya viaja por IPC. Con el orden inverso la ventana no aparecia durante el
 * arranque y Windows marcaba la aplicacion como "no responde", que en el local
 * se lee como que el programa se colgo.
 */

import { app, BrowserWindow, shell } from 'electron'
import { writeFile } from 'fs/promises'
import path from 'path'
import { cerrarBaseDeDatos, respaldarSiCorresponde } from './db'
import { obtenerConfiguracion } from './db/configuracion'
import { registrarCanales } from './ipc'

/**
 * Medicion del arranque. Queda escrita en `arranque.log` dentro de userData:
 * si en la PC del local la app tarda en abrir, el archivo dice en que paso.
 */
const hitos: string[] = []

function marcar(nombre: string): void {
  hitos.push(`${String(Math.round(process.uptime() * 1000)).padStart(6)} ms  ${nombre}`)
}

async function guardarMedicion(): Promise<void> {
  try {
    await writeFile(
      path.join(app.getPath('userData'), 'arranque.log'),
      `Arranque del ${new Date().toLocaleString('es-AR')}\n(milisegundos desde que se inicio el proceso)\n\n` +
        hitos.join('\n') +
        '\n',
      'utf8'
    )
  } catch {
    // Que no se pueda escribir el log no es motivo para molestar al operador.
  }
}

marcar('proceso principal cargado')

function crearVentana(): void {
  const enDesarrollo = Boolean(process.env['ELECTRON_RENDERER_URL'])
  // En produccion el icono lo pone el ejecutable; en desarrollo hay que darselo.
  const icono = enDesarrollo ? { icon: path.join(__dirname, '../../build/icon.ico') } : {}

  const ventana = new BrowserWindow({
    ...icono,
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    title: 'Punto de Retiro',
    autoHideMenuBar: true,
    // Del mismo color que el fondo de la interfaz, para que no pegue un
    // flash blanco entre que aparece la ventana y carga el contenido.
    backgroundColor: '#eef1f6',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  let mostrada = false
  const mostrar = (): void => {
    if (mostrada || ventana.isDestroyed()) return
    mostrada = true
    ventana.maximize()
    ventana.show()
    marcar('ventana visible')
    void guardarMedicion()
  }

  ventana.on('ready-to-show', () => {
    marcar('contenido listo para mostrarse')
    mostrar()
  })

  // Red de seguridad: si `ready-to-show` no llega, la ventana se muestra igual.
  // Vale mas una ventana a medio pintar que una que nunca aparece.
  setTimeout(mostrar, 2500)

  ventana.webContents.on('did-finish-load', () => marcar('interfaz cargada'))

  // Cualquier link externo va al navegador, no abre una ventana de Electron.
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (enDesarrollo) {
    ventana.loadURL(process.env['ELECTRON_RENDERER_URL'] as string)
  } else {
    ventana.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  marcar('electron listo')
  registrarCanales()
  crearVentana()
  marcar('ventana creada')

  // El respaldo diario corre despues, no durante el arranque.
  setTimeout(() => {
    void respaldarSiCorresponde(obtenerConfiguracion().carpeta_respaldo)
  }, 4000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  cerrarBaseDeDatos()
})
