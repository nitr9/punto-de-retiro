# Punto de Retiro

Aplicación de escritorio para un punto de retiro de paquetes de Mercado Libre.
Registra la entrada de paquetes cuando llega la mercadería, la salida cuando el cliente
los retira, y el pendiente: qué está guardado, dónde, y hasta cuándo.

## Comandos

| Comando | Para qué |
|---|---|
| `npm run dev` | Levanta la app en modo desarrollo, con recarga automática |
| `npm run build` | Compila los tres procesos a `out/` |
| `npm run typecheck` | Verifica tipos sin compilar |
| `npm run dist` | Genera el instalador `.exe` en `release/` |
| `npm run datos-prueba` | Carga paquetes de ejemplo para recorrer la app |
| `npm run borrar-prueba` | Borra solo los de ejemplo (prefijo `DEMO-`) |

## Arquitectura

Electron con tres procesos separados, más una carpeta compartida:

- **`src/main/`** — Proceso principal. Es el **único** que toca la base de datos.
  - `index.ts` abre la ventana y la base.
  - `ipc.ts` registra los canales. Cada handler devuelve un sobre `Respuesta<T>`
    (`{ok:true,dato}` o `{ok:false,mensaje}`) para que los errores lleguen legibles
    a la pantalla en lugar del texto interno de Electron.
  - `db/` es la capa de datos: `paquetes.ts` es el núcleo, más `lotes`, `operadores`,
    `configuracion` y `schema.ts`.
- **`src/preload/`** — Puente seguro. Expone `window.api` con `contextBridge`.
  Abre el sobre de respuesta y lanza un `Error` normal si algo falló, para que las
  pantallas usen `try/catch`.
- **`src/renderer/`** — Interfaz en React. **No tiene acceso a Node ni a la base**:
  solo puede llamar a `window.api`.
- **`src/shared/`** — Tipos (`types.ts`), contrato del puente (`api.ts`) y utilidades
  de fecha (`fechas.ts`). Lo usan los tres lados.

### Modelo de datos

`paquetes` (el centro), `lotes` (cada llegada de camión), `operadores`, `configuracion`
y `movimientos` (bitácora de auditoría, solo se agregan filas, nunca se modifican ni se
borran: es lo que permite responder un reclamo).

Regla clave: un índice único parcial impide que el mismo código esté dos veces
**en stock**, pero permite que se repita en el historial si el paquete ya salió.

Las fechas se guardan como texto (`YYYY-MM-DD HH:mm:ss`) en hora local, no UTC:
los reportes son "lo que entró hoy" según el reloj del mostrador.

## Tres cosas que no se deducen leyendo el código

**1. El archivo `.npmrc` es obligatorio.** Fuerza a que `better-sqlite3` se descargue
precompilado para Electron. Sin él, `npm install` falla intentando compilar con Visual
Studio y pide el compilador ClangCL. Si aparece un error de `NODE_MODULE_VERSION`,
correr `npx electron-builder install-app-deps`.

**2. El plazo de retiro es configurable, en tres niveles.** Lo define Mercado Libre y
puede cambiar, así que nadie debería tocar código para ajustarlo:
- el dueño fija el plazo por defecto en días desde Configuración;
- al recibir cada paquete, la fecha límite viene sugerida pero se puede pisar;
- después se edita en la ficha del paquete.

**3. No hay integración con la API de Mercado Libre.** No existe API pública para puntos
de retiro de terceros: el sistema oficial (Mercado Envíos Places) es aparte y de uso
obligatorio. Esta app es un **control interno paralelo**; la carga es manual o por
escaneo. Su valor está en lo que el sistema oficial no da: ubicación física en el
depósito, búsqueda instantánea, trazabilidad de quién recibió y entregó, y alertas de
vencimiento.

## Alcance: qué es y qué no es

Es una **herramienta de control para el dueño del local y sus empleados**. Responde
preguntas que hoy no tienen respuesta rápida: dónde está guardado un paquete, cuántos
hay, cuáles hay que devolver esta semana, quién recibió y quién entregó cada uno.

**No es un sistema de atención al cliente ni reemplaza nada de Mercado Libre.** Todo lo
que mira el cliente final —comprobantes, avisos, firma de retiro, códigos— ya lo emite
el sistema oficial de Mercado Libre y el local lo tiene resuelto. No hay que duplicarlo.

Al evaluar una función nueva, la pregunta es: *¿le sirve al dueño para controlar su
operación?* Si la respuesta es "esto ya se lo da Mercado Libre", no va.

### Cómo trabajan hoy en el local

**Al recibir**, ni bien entra el paquete lo copian a mano en una planilla de Excel:
nombre, teléfono, a veces DNI, y el código del paquete. Usan **una hoja por día**
(por ejemplo `04/08/2026`), y en un mismo día puede llegar mercadería más de una vez.

**Al entregar**, escanean el código con la app oficial de Mercado Libre **desde el
teléfono** y lo marcan como entregado ahí. Para Mercado Libre, con eso el circuito está
cerrado. Después, para su propio orden, **pintan de verde ese renglón del Excel**.

Ezequiel, el dueño, quiere ese registro propio de lo que entra, lo que sale y qué pasa
con cada paquete. Esa es la razón de ser de esta aplicación.

### Qué se copió de esa forma de trabajar

El diseño imita el flujo que ya tienen, en vez de pedirles que cambien de costumbre:

- **Código y destinatario van juntos y grandes** en Recepción, porque son los dos datos
  que cargan en todos los paquetes. Teléfono, DNI y observaciones quedan en segunda fila.
- **Marcar entregado desde el listado en un clic** (botón verde en la fila) es el
  equivalente exacto a pintar el renglón. Quién retira es opcional: si no se aclara, se
  asume el destinatario. La pantalla de Entrega completa queda para cuando viene un
  tercero o hace falta buscar el paquete.
- **Filtro por fecha de ingreso**, con un acceso directo a "lo que entró hoy", que
  reemplaza la hoja del día.
- Los **lotes** cubren que llegue mercadería varias veces en la misma jornada.

### El riesgo real del proyecto: la doble carga

Cada paquete se toca dos veces: una en la app de Mercado Libre (obligatoria) y otra acá.
Si cargar acá cuesta trabajo, los empleados van a saltearla y el registro va a quedar
incompleto — y un registro incompleto no sirve para controlar nada.

Por eso el diseño apunta a que la app **se gane el lugar en el flujo de trabajo** en vez
de imponerse:

- **Al entregar**, el empleado necesita saber en qué estante está el paquete antes de ir
  a buscarlo. Mercado Libre no se lo dice; esta app sí, en letra grande. Entonces la
  abre porque le conviene, no porque se lo mandaron.
- **Al recibir**, escanear un paquete tiene que costar un segundo: el foco no se va del
  campo, la ubicación y la fecha quedan fijas entre paquetes, y no hay que confirmar nada.

**Toda función nueva se mide contra esto.** Si agrega pasos a la recepción o a la
entrega, hay que pensarla de nuevo.

## El arranque no puede bloquearse

La ventana se crea **antes** que la base de datos, y la base se abre sola en la primera
consulta (que ya viaja por IPC). El orden inverso dejaba la ventana sin aparecer durante
el arranque, y Windows marcaba la aplicación como "no responde" — en el local eso se lee
como que el programa se colgó.

Por lo mismo, el respaldo diario usa el **respaldo por páginas de SQLite**
(`db.backup()`, asíncrono) y corre 4 segundos después del arranque, no durante. Copiar el
archivo entero de forma sincrónica congelaba la app, y el problema iba a empeorar a
medida que creciera la base.

**Regla:** nada que tarde puede correr antes de que la ventana esté visible.

## Generar el instalador

`npm run dist` no alcanza por sí solo en este entorno. Hacen falta dos cosas:

1. **`CSC_IDENTITY_AUTO_DISCOVERY=false`** antes de correrlo, para que no busque certificados
   de firma que no existen.
2. **Las herramientas de firma de Windows extraídas a mano.** electron-builder descarga
   `winCodeSign-2.6.0.7z`, que contiene enlaces simbólicos de macOS, y Windows no permite
   crearlos sin privilegios: la extracción falla y aborta el empaquetado. Se resuelve una
   sola vez, extrayéndolo sin la carpeta `darwin`:

   ```powershell
   $dest = "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0"
   # descargar winCodeSign-2.6.0.7z desde electron-builder-binaries y luego:
   & "node_modules\7zip-bin\win\x64\7za.exe" x $zip "-o$dest" -xr'!darwin' -y
   ```

El paquete queda en `release\`: el instalador `.exe` y la carpeta `win-unpacked`, que es
la versión que funciona sin instalar.

`herramientas/afterpack-limpiar.js` borra 52 archivos de idioma de Chromium (38 MB) en cada
empaquetado. No es solo por tamaño: Windows Defender escanea los archivos sueltos de a uno
la primera vez que se ejecuta un programa recién instalado.

## El ejecutable no está firmado

Windows va a mostrar la advertencia de SmartScreen al instalar (se pasa con "Más
información" → "Ejecutar de todas formas"). En equipos con **Control de aplicaciones
inteligente** activo, el bloqueo es más duro: puede impedir la ejecución directamente.

Para verificar en una máquina:

```powershell
(Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy").VerifiedAndReputablePolicyState
```

`0` = desactivado (todo bien), `1` = bloqueando, `2` = en evaluación. Solo viene activo en
instalaciones limpias de Windows 11. Se puede apagar, pero **no se puede volver a encender
sin reinstalar Windows**. La solución de fondo es un certificado de firma de código
(200-400 USD/año), que no se justifica para un local.

## Dónde viven los datos

`%APPDATA%\punto-retiro\datos\punto-retiro.db`, **fuera de la carpeta de instalación**. Por
eso reinstalar o actualizar la app no borra nada, y desinstalarla tampoco. Cada cuenta de
Windows tiene su propia base: en el local usan siempre la misma cuenta, así que no es un
problema, pero si eso cambiara habría que mover la base a una ubicación compartida.

La copia diaria va a `datos\backups\` y se conservan las últimas 30. Como eso vive en el
mismo disco que la base, Configuración permite elegir **una segunda carpeta** (un pendrive
fijo, una carpeta de red) donde se duplica: un disco roto se llevaba la base y sus treinta
respaldos juntos. Si esa carpeta no está disponible —el pendrive desenchufado es lo normal—
se registra en consola y la copia local se hace igual: **el respaldo externo nunca puede
impedir el local**.

## Detalle del entorno

Si Electron arranca y muere con `Cannot read properties of undefined (reading 'whenReady')`,
la causa es la variable `ELECTRON_RUN_AS_NODE=1`, que definen la extensión de VS Code y
algunos agentes. Obliga a Electron a comportarse como Node y por eso no existe `app`.
No es un problema del código: hay que limpiarla antes de lanzar.

## Estado

**MVP terminado y funcionando.** Cuatro pantallas, navegables con F1 a F4:

- **Entregar** — busca por código, nombre, DNI o teléfono; muestra la ubicación en grande
  y registra quién retiró.
- **Recibir** — escaneo continuo por lote, con ubicación y fecha fijas entre paquetes,
  detección de duplicados y comparación contra lo declarado en el remito.
- **Stock** — semáforo por vencimiento, lo que vence primero arriba, devolución masiva a ML.
- **Configuración** — plazo, operadores, ubicaciones y copias de seguridad.

Verificado: esquema y semillas se crean al arrancar, la regla de duplicados funciona,
compila sin errores de tipos. La interfaz fue probada a mano por el usuario.

Agregado después: **calendario mensual** en la pantalla de stock. Muestra cuántos paquetes
entraron y salieron cada día y permite entrar a un día con un clic. Reemplaza la carpeta de
planillas de Excel, que era una hoja por fecha.

**El local no usa estantes**: apilan los paquetes en el piso. Por eso las ubicaciones son
opcionales (`usar_ubicaciones` en Configuración): al desactivarlas desaparecen el campo, la
columna y el aviso de "sin ubicación", que si no marcaría un problema inexistente en todos
los paquetes.

### Cosas que se arreglaron y por qué (no repetirlas)

Cuatro problemas que no se ven probando la app un rato, pero aparecen con el uso diario:

- **La copia automática estaba en el mismo disco que la base.** Ver "Dónde viven los datos".
- **El lote quedaba abierto de un día para el otro.** Nada lo cierra solo y el botón "Cerrar
  recepción" es fácil de olvidar. Los paquetes del día siguiente se sumaban a esa tanda y la
  comparación contra el remito —lo único que detecta faltantes— terminaba mezclando dos días.
  Ahora Recepción avisa si el lote abierto es de otra fecha y ofrece cerrarlo en un clic.
- **El listado se cortaba en 500 sin decirlo.** Los contadores de arriba usan `COUNT(*)` sobre
  toda la tabla, así que con más de 500 en stock la tarjeta y la tabla mostraban números
  distintos, sin señal de que faltaba el resto. `buscar()` ahora devuelve `{paquetes, total}`
  y la pantalla avisa "mostrando los primeros N de M". El `COUNT` extra solo se ejecuta cuando
  la consulta llegó al tope.
- **La fecha límite sugerida se calculaba al montar la pantalla.** La app se abre a la mañana y
  queda abierta; si Recepción pasaba la noche abierta, los paquetes del día siguiente entraban
  con la fecha de ayer y aparecían vencidos un día antes. Ahora se recalcula al guardar, pero
  **solo si el operador no la editó a mano**.

Regla que dejan estos cuatro: **la app se usa muchas horas seguidas y muchos días seguidos.**
Todo lo que se calcule una sola vez al abrir una pantalla —fechas, "hoy", totales— hay que
pensarlo también para el segundo día.

### Pendientes

1. Instalar en la PC del local y usarlo unos días con paquetes reales. **Es el próximo
   paso**: lo que salga de ahí vale más que cualquier función agregada adivinando.
2. Reportes y cierre de día para el dueño: cuánto entró y salió por período, cuántos se
   devolvieron por no retirarse a tiempo, actividad por operador. Gráficos con Recharts.
   El calendario ya cubre parte de lo que iba a mirar ahí.
3. Considerar un PIN por operador si el local necesita restringir quién entrega.

Descartado: **impresión de comprobante de entrega**. El comprobante y la firma del
cliente ya los emite el sistema oficial de Mercado Libre; duplicarlo sería papel de más.
