# 🖨️ Monitor de Impresoras

Bienvenido al sistema de monitoreo de impresoras. Este panel te permitirá saber en tiempo real el estado de tus impresoras (si están encendidas, si tienen papel y cuánto tóner les queda).

---

## 🛠️ Cómo descargar e instalar (Paso a Paso)

No necesitas tener conocimientos técnicos ni instalar programas complejos manualmente. Sigue estos simples pasos:

### Paso 1: Descargar el archivo
1. Haz clic en el botón verde **"Code"** (Código) en la parte superior derecha de esta página.
2. Selecciona **"Download ZIP"** (Descargar ZIP).
3. Una vez descargado, **descomprime** la carpeta en el lugar donde quieras guardar el programa (por ejemplo, en tus Documentos o Escritorio).

### Paso 2: Instalación Automática
1. Abre la carpeta que acabas de descomprimir.
2. Busca el archivo llamado **`install.bat`** y hazle **doble clic**.
3. Se abrirá una ventana negra que empezará a instalar todo lo necesario automáticamente (Node.js y Python, en caso de que tu PC no los tenga).
4. El proceso toma un par de minutos. Al finalizar dirá **"Instalación completa"** y te pedirá que presiones una tecla para cerrar.

> **💡 Nota de Seguridad:** Si Windows (Control Inteligente de Aplicaciones o Windows Defender) muestra una advertencia azul diciendo "Windows protegió su PC", haz clic en **"Más información"** y luego en **"Ejecutar de todas formas"**. Es una advertencia común para programas descargados de internet.

---

## 🚀 Cómo usar el Panel

Una vez instalado, abrir el sistema es facilísimo:

1. Ve a la carpeta de tu programa.
2. Haz doble clic en el archivo **`start.bat`**.
3. Se abrirá una pequeña ventana negra que debes dejar abierta (es el motor del sistema).
4. Automáticamente se abrirá tu navegador web con el **Panel de Control**.

Si quieres tener un acceso más rápido la próxima vez:
- Haz clic derecho sobre `start.bat`.
- Elige **"Mostrar más opciones"** -> **"Enviar a"** -> **"Escritorio (crear acceso directo)"**.

---

## 🖥️ ¿Qué puedes hacer en el Panel?

El panel (que funciona en la dirección local `http://127.0.0.1:3000`) tiene dos pestañas principales en el menú izquierdo:

### 1. Monitoreo (Pantalla Principal)
Aquí verás el estado en vivo de todas tus impresoras. Se actualizará solo para mostrarte:
- Si la impresora está **Online** o **Offline**.
- El porcentaje de Tóner.
- Si las bandejas tienen papel (OK) o están vacías (Alerta).

### 2. Impresoras (Añadir o Quitar)
Aquí podrás gestionar tus impresoras. 
- Puedes agregar nuevas haciendo clic en **"Nueva Impresora"**. Solo necesitas saber la Dirección IP (Ej: `10.160.104.170`) y ponerle un nombre para reconocerla.
- También puedes editar o eliminar las impresoras que ya no uses. ¡Todos los cambios se aplican al instante!

---

## 🚨 Solución a problemas comunes

**"La impresora sale Offline pero yo sé que está encendida"**
- Asegúrate de que la Dirección IP sea la correcta.
- Ve a la pestaña **Impresoras**, edita la impresora y verifica que la IP no tenga espacios en blanco al final o al principio.

**"Cerré la ventana negra por accidente y la página web ya no carga"**
- Esa ventana negra es el motor del sistema. Si la cierras, el sistema se apaga. Simplemente vuelve a hacer doble clic en `start.bat` para encenderlo de nuevo.
