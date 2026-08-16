/**
 * Genera el icono de la aplicacion: build/icon.ico
 *
 *   npm run icono
 *
 * Dibuja el icono en SVG, lo rasteriza con el propio Chromium de Electron y
 * arma el archivo .ico con todos los tamanos que usa Windows. No hace falta
 * ningun programa de diseno ni dependencias extra.
 *
 * El diseno es una caja isometrica sobre fondo azul: a 16 pixeles, que es como
 * se ve en la barra de tareas, lo unico que se distingue es la silueta, asi que
 * la caja va grande, centrada y con mucho contraste contra el fondo.
 */
const { app, BrowserWindow, nativeImage } = require('electron')
const fs = require('fs')
const path = require('path')

const LADO = 256
const TAMANOS = [256, 128, 64, 48, 32, 16]
const destino = path.join(__dirname, '..', 'build', 'icon.ico')

const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <linearGradient id="fondo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2b6fd4"/>
      <stop offset="1" stop-color="#123f80"/>
    </linearGradient>
    <linearGradient id="tapa" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#e8eef7"/>
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="256" height="256" rx="56" fill="url(#fondo)"/>

  <!-- Caja isometrica. Tres caras con distinto tono para que se lea el volumen
       aun en tamanos chicos. -->
  <g transform="translate(128 134)">
    <!-- Cara superior -->
    <path d="M 0,-74 L 74,-37 L 0,0 L -74,-37 Z" fill="url(#tapa)"/>
    <!-- Cara izquierda -->
    <path d="M -74,-37 L 0,0 L 0,76 L -74,39 Z" fill="#a8bcd6"/>
    <!-- Cara derecha -->
    <path d="M 74,-37 L 74,39 L 0,76 L 0,0 Z" fill="#7f99bb"/>
    <!-- Cinta de embalaje sobre la tapa -->
    <path d="M 0,-74 L 18,-65 L 18,-9 L 0,0 L -18,-9 L -18,-65 Z" fill="#f0b429" opacity="0.95"/>
    <!-- Cinta bajando por la cara derecha -->
    <path d="M 18,-9 L 18,67 L 0,76 L 0,0 Z" fill="#d99a1a" opacity="0.9"/>
  </g>
</svg>
`

/** Arma un .ico a partir de varios PNG. Windows acepta PNG embebido desde Vista. */
function armarIco(imagenes) {
  const cabecera = Buffer.alloc(6)
  cabecera.writeUInt16LE(0, 0) // reservado
  cabecera.writeUInt16LE(1, 2) // 1 = icono
  cabecera.writeUInt16LE(imagenes.length, 4)

  const entradas = []
  let desplazamiento = 6 + imagenes.length * 16

  for (const { tamano, png } of imagenes) {
    const entrada = Buffer.alloc(16)
    entrada.writeUInt8(tamano >= 256 ? 0 : tamano, 0) // 0 representa 256
    entrada.writeUInt8(tamano >= 256 ? 0 : tamano, 1)
    entrada.writeUInt8(0, 2) // paleta
    entrada.writeUInt8(0, 3) // reservado
    entrada.writeUInt16LE(1, 4) // planos
    entrada.writeUInt16LE(32, 6) // bits por pixel
    entrada.writeUInt32LE(png.length, 8)
    entrada.writeUInt32LE(desplazamiento, 12)
    entradas.push(entrada)
    desplazamiento += png.length
  }

  return Buffer.concat([cabecera, ...entradas, ...imagenes.map((i) => i.png)])
}

app.whenReady().then(async () => {
  const ventana = new BrowserWindow({
    width: LADO,
    height: LADO,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: { offscreen: true }
  })

  // overflow:hidden es imprescindible: sin eso Chromium dibuja las barras de
  // desplazamiento y quedan capturadas dentro del icono.
  const estilo =
    'html,body{margin:0;padding:0;width:256px;height:256px;overflow:hidden;background:transparent}' +
    'svg{display:block}'
  const html = `<!doctype html><html><head><style>${estilo}</style></head><body>${SVG}</body></html>`
  await ventana.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))

  // Un respiro para que termine de dibujar el degradado antes de capturar.
  await new Promise((r) => setTimeout(r, 400))

  const captura = await ventana.webContents.capturePage()
  const imagenes = TAMANOS.map((tamano) => ({
    tamano,
    png:
      tamano === LADO
        ? captura.toPNG()
        : captura.resize({ width: tamano, height: tamano, quality: 'best' }).toPNG()
  }))

  fs.mkdirSync(path.dirname(destino), { recursive: true })
  fs.writeFileSync(destino, armarIco(imagenes))

  // Tambien se deja un PNG grande, util para accesos directos o documentacion.
  fs.writeFileSync(path.join(path.dirname(destino), 'icon.png'), captura.toPNG())

  fs.writeFileSync(
    path.join(require('os').tmpdir(), 'icono-generado.txt'),
    `icon.ico creado con ${imagenes.length} tamaños: ${TAMANOS.join(', ')}`
  )

  app.quit()
})
