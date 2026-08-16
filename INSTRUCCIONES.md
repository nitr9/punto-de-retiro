# Punto de Retiro — Cómo usarlo

Guía para el local. No hace falta saber nada de computación.

---

## Instalación

1. Copiar el archivo `Punto de Retiro Setup.exe` a la computadora del local (por pendrive
   o como sea más cómodo).
2. Hacer doble clic.
3. **Va a aparecer una advertencia azul de Windows** que dice "Windows protegió tu PC".
   Es normal: aparece con todo programa que no está firmado por una empresa registrada.
   Hay que tocar **"Más información"** (el texto chico) y después
   **"Ejecutar de todas formas"**.
4. Seguir la instalación. Al terminar queda el acceso directo en el escritorio.

Se instala una sola vez y **no pide contraseña de administrador**. Después se abre como
cualquier programa y la advertencia no vuelve a aparecer.

### Si Windows lo bloquea sin dejar continuar

Algunas computadoras con Windows 11 tienen activado el **"Control de aplicaciones
inteligente"**, que bloquea sin ofrecer la opción de seguir. Se apaga en
*Seguridad de Windows → Control de aplicaciones y explorador*.

**Atención:** una vez apagado, Windows no permite volver a encenderlo sin reinstalar el
sistema. Usarlo solo si no hay otra forma.

Si el bloqueo viene de un antivirus de terceros, alcanza con agregar la carpeta del
programa como excepción.

---

## El día a día

La aplicación tiene cuatro pantallas. Se cambia entre ellas con las teclas **F1, F2, F3 y F4**,
o haciendo clic en el menú de la izquierda.

### Cuando llega el camión — **Recibir paquetes (F2)**

1. Tocar **Empezar a recibir**. Si el remito dice cuántos paquetes vienen, cargarlo en
   **Paquetes declarados**: así la aplicación avisa si al final falta alguno.
2. Si usan estantes, escribir en **Ubicación en el depósito** dónde se van a guardar
   (por ejemplo `A-1`). Queda fijo: no hay que volver a escribirlo en cada paquete. Si
   los paquetes se apilan sin un lugar fijo, este campo se puede sacar (ver Configuración).
3. Por cada paquete: escribir el **código** y el **nombre**, y apretar **Enter**.
   El cursor vuelve solo al código, listo para el siguiente.
4. Teléfono y DNI son opcionales. Si el paquete vino golpeado o mojado, anotarlo en
   **Observaciones**: eso se muestra bien visible el día que el cliente lo retire.
5. Al terminar, tocar **Cerrar recepción**.

> Si se escanea dos veces el mismo paquete, la aplicación avisa y dice en qué estante
> está el que ya se había cargado. No se duplica.

### Cuando viene el cliente — **Entregar paquete (F1)**

1. Escribir el código, el nombre, el DNI o el teléfono, y apretar Enter.
2. Aparece la ficha con los datos del paquete y, si usan estantes, **dónde está
   guardado**, en letra grande.
3. Ir a buscarlo, escanearlo con el teléfono en la aplicación de Mercado Libre como
   siempre, y después tocar **Entregar paquete**.

Si lo retira otra persona (un familiar, un vecino), cambiar el nombre antes de confirmar.
Queda registrado quién se lo llevó.

**Atajo:** si ya sabés cuál es, en **Paquetes en stock (F3)** cada fila tiene un botón
verde **"Entregado"**. Un clic y listo.

### Para controlar — **Paquetes en stock (F3)**

Muestra todo lo que hay guardado. Los colores son la clave:

| Color | Significa |
|---|---|
| **Verde** | Tiene tiempo de sobra |
| **Amarillo** | Vence hoy o mañana — conviene llamar al cliente |
| **Rojo** | Ya venció — hay que devolverlo a Mercado Libre |

Para devolver: tildar los que correspondan y tocar el botón rojo **"Marcar … como
devuelto a Mercado Libre"**, que aparece al tildar el primero.

El botón **"Lo que entró hoy"** arma la lista del día, como la hoja de Excel de antes.

### Ajustes — **Configuración (F4)**

- **Días de plazo por defecto**: con cuántos días se calcula la fecha límite al recibir.
  Si Mercado Libre cambia el plazo, se cambia acá y listo. Igual, en cada paquete se
  puede poner otra fecha a mano.
- **Avisar cuántos días antes de vencer**: cuándo empiezan a ponerse amarillos.
- **"Guardamos los paquetes en estantes identificados"**: si los apilan sin un lugar
  fijo, **destildar**. Desaparece el campo de ubicación de todas las pantallas y la
  aplicación deja de avisar que faltan ubicaciones.
- **Ubicaciones del depósito**: los estantes, separados por coma. Solo aparece si la
  opción de arriba está tildada.
- **Operadores**: quiénes atienden. Queda registrado quién recibió y quién entregó cada
  paquete. No se borran, se desactivan, para no perder ese historial.

Después de cambiar algo, tocar **Guardar configuración**.

---

## Copias de seguridad — importante

La aplicación guarda una copia sola, todos los días, y conserva las últimas 30. El
problema es que quedan en el mismo disco: si esa computadora se rompe o se la roban, se
van los datos y las copias juntos.

**Por eso conviene hacer esto una sola vez:** en **Configuración (F4)**, en **"Segunda
carpeta para la copia diaria"**, elegir un pendrive que quede siempre enchufado (o una
carpeta de red) con el botón **Elegir…**. Desde ahí, la copia de cada día se guarda
también ahí sola, sin que nadie se acuerde de hacerla.

Si el pendrive no está conectado ese día, no pasa nada: la copia local se hace igual, y
la aplicación avisa en esa misma pantalla si la copia de afuera quedó atrasada.

Para llevarse una copia en el momento —por ejemplo, antes de cambiar de computadora—
está el botón **"Guardar copia ahora en otra carpeta"**, abajo de todo en la misma
pantalla.

---

## Preguntas frecuentes

**¿Necesito internet?**
No. Funciona sin conexión.

**¿Reemplaza a la aplicación de Mercado Libre?**
No. Hay que seguir escaneando con el teléfono en Mercado Libre igual que siempre. Esta
aplicación es el control propio del local: dónde está cada paquete, qué hay que devolver
y quién atendió cada operación.

**¿Sirve un lector de código de barras?**
Sí, y conviene mucho. Se enchufa por USB y funciona sin instalar nada: al escanear, es
como si alguien tipeara el código y apretara Enter. Cuesta alrededor de 20 dólares y
evita los errores de copiar códigos largos a mano.

**Me equivoqué al cargar un paquete.**
En **Paquetes en stock (F3)**, botón **"Ver / editar"** de esa fila. Se puede corregir
todo, y queda registrado el cambio en el historial del paquete.
