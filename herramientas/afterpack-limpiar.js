/**
 * Limpieza posterior al empaquetado.
 *
 * Electron trae los archivos de idioma de Chromium para 55 idiomas: 40 MB en 55
 * archivos sueltos que esta aplicación nunca va a usar. Sacarlos no solo achica
 * la instalación: la primera vez que se ejecuta un programa recién instalado,
 * Windows Defender escanea los archivos de a uno, y ese escaneo es lo que hacía
 * que la app tardara en abrir y Windows la marcara como "no responde".
 *
 * Se conservan el español y el inglés (Chromium lo necesita como respaldo).
 */
const fs = require('fs')
const path = require('path')

const IDIOMAS_QUE_QUEDAN = new Set(['es.pak', 'es-419.pak', 'en-US.pak'])

exports.default = async function limpiar(context) {
  const carpetaIdiomas = path.join(context.appOutDir, 'locales')
  if (!fs.existsSync(carpetaIdiomas)) return

  let borrados = 0
  let bytesLiberados = 0

  for (const archivo of fs.readdirSync(carpetaIdiomas)) {
    if (!archivo.endsWith('.pak') || IDIOMAS_QUE_QUEDAN.has(archivo)) continue
    const ruta = path.join(carpetaIdiomas, archivo)
    try {
      bytesLiberados += fs.statSync(ruta).size
      fs.unlinkSync(ruta)
      borrados++
    } catch {
      // Si alguno no se puede borrar, no vale la pena frenar el empaquetado.
    }
  }

  const mb = (bytesLiberados / 1024 / 1024).toFixed(1)
  console.log(`  • idiomas innecesarios eliminados  archivos=${borrados} liberado=${mb} MB`)
}
