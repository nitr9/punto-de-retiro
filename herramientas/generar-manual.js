// Convierte herramientas/manual.html en un PDF listo para pasarle al dueño del local.
// Usa el Chromium que ya trae Electron: no hace falta instalar nada más.
//   npm run manual
const { app, BrowserWindow } = require('electron')
const { writeFileSync } = require('fs')
const { join } = require('path')

const ORIGEN = join(__dirname, 'manual.html')
const DESTINO = join(__dirname, '..', 'Punto de Retiro - Manual.pdf')

app.whenReady().then(async () => {
  const ventana = new BrowserWindow({ show: false, width: 1200, height: 1600 })
  await ventana.loadFile(ORIGEN)

  const pdf = await ventana.webContents.printToPDF({
    pageSize: 'A4',
    printBackground: true, // sin esto se pierden los colores del semáforo
    // En pulgadas, y mandan sobre el margen de @page: con esto en cero, de la
    // segunda hoja en adelante el texto arrancaba pegado al borde del papel.
    margins: { marginType: 'custom', top: 0.63, bottom: 0.63, left: 0.63, right: 0.63 }
  })

  writeFileSync(DESTINO, pdf)
  console.log(`Manual generado: ${DESTINO}`)
  app.quit()
})
