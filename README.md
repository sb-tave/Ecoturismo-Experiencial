# Raíz · Plataforma de ecoturismo

Marketplace web para publicar, buscar y reservar alojamientos rurales, actividades de naturaleza y negocios locales.
Proyecto final de Ingeniería de Software I (*Eco Turismo Experiencial*).

Esta guía explica, paso a paso y desde cero, cómo instalar y ejecutar el proyecto en **Windows con PowerShell**.
No necesitas experiencia previa: solo seguir los pasos en orden.

> **¿Ya instalaste todo antes?** Salta directo a [Uso diario (inicio rápido)](#uso-diario-inicio-rápido).

## Contenido

1. [Qué vas a lograr](#qué-vas-a-lograr)
2. [Parte 1 · Instalar los programas](#parte-1--instalar-los-programas-solo-la-primera-vez)
3. [Parte 2 · Obtener el proyecto](#parte-2--obtener-el-proyecto)
4. [Parte 3 · Encender el backend](#parte-3--encender-el-backend)
5. [Parte 4 · Cargar los datos de prueba](#parte-4--cargar-los-datos-de-prueba-una-sola-vez)
6. [Parte 5 · Encender el frontend](#parte-5--encender-el-frontend)
7. [Parte 6 · Ingresar a la aplicación](#parte-6--ingresar-a-la-aplicación)
8. [Parte 7 · Probar el flujo completo](#parte-7--probar-el-flujo-completo)
9. [Uso diario (inicio rápido)](#uso-diario-inicio-rápido)
10. [Solución de problemas](#solución-de-problemas)
11. [Documentación técnica](#documentación-técnica)
12. [macOS y Linux](#macos-y-linux)

---

## Qué vas a lograr

Al terminar tendrás funcionando en tu computador:

- **El backend** (la API y la base de datos) corriendo en Docker, en <http://localhost:3000>.
- **El frontend** (la aplicación que ves en el navegador) corriendo en <http://localhost:5173>.
- **Cuentas de prueba** para ver cada experiencia: turista, anfitrión y administrador.

Necesitarás **tres ventanas abiertas a la vez**: Docker Desktop, una ventana de PowerShell para el backend y otra para el frontend.

El repositorio contiene dos carpetas:

```
├── Backend/    API REST + base de datos PostgreSQL (se ejecuta en Docker)
└── Frontend/         Aplicación web hecha con Vue (se ejecuta con Node.js)
```

> Si tus carpetas se llaman distinto, no hay problema. Lo importante es esto: la carpeta del **backend** es la que contiene
> el archivo `docker-compose.yml` y la del **frontend** es la que contiene `index.html`. Ambas tienen un `package.json`.

---

## Parte 1 · Instalar los programas (solo la primera vez)

| Programa | Para qué sirve | Descarga |
| --- | --- | --- |
| **PowerShell** | La ventana donde escribes los comandos | [Microsoft Store](https://apps.microsoft.com/detail/9mz1snwt0n5d?hl=es-ES&gl=CL) |
| **Node.js 26 (LTS)** | Ejecuta el frontend (incluye `npm`) | [Node.js 26.13.1](https://nodejs.org/en/blog/release/v26.13.1) |
| **Docker Desktop** | Ejecuta el backend y la base de datos | [Docker Desktop](https://www.docker.com/products/docker-desktop/) |

### 1.1 PowerShell

Windows ya trae PowerShell: pulsa la tecla Windows, escribe `PowerShell` y pulsa Enter. Esta guía funciona con esa versión.

Si prefieres la versión más reciente (PowerShell 7), instálala gratis desde [Microsoft Store](https://apps.microsoft.com/detail/9mz1snwt0n5d?hl=es-ES&gl=CL).

### 1.2 Node.js

1. Abre la página de [Node.js 26.13.1 (LTS)](https://nodejs.org/en/blog/release/v26.13.1).
2. Descarga el instalador de Windows que aparece en esa página:
   - **Windows 64-bit Installer** (<https://nodejs.org/dist/v26.13.1/node-v26.13.1-x64.msi>): sirve para la mayoría de los computadores.
   - **Windows ARM 64-bit Installer**: solo si tu computador tiene procesador ARM.
3. Ejecuta el instalador y acepta todas las opciones por defecto.
4. **Cierra PowerShell** si lo tenías abierto y ábrelo de nuevo.
5. Comprueba la instalación:

   ```powershell
   node -v
   npm -v
   ```

   Cada comando debe mostrar un número de versión. Node debe ser **20 o superior** (esta guía usa la 26.13.1).

> Node.js solo hace falta para el frontend. El backend corre dentro de Docker, con su propia versión de Node.

### 1.3 Docker Desktop

1. Entra a [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) y descarga **Docker Desktop para Windows**
   (botón *Download for Windows – AMD64*; si tu computador tiene procesador ARM, usa *ARM64*).
2. Ejecuta el instalador.
3. Si te pide activar **WSL 2**, acepta.
4. Si te pide **reiniciar el computador**, hazlo.
5. Abre Docker Desktop y espera a que, abajo a la izquierda, diga **Engine running** (en verde).
   **Docker Desktop debe estar abierto siempre que uses el sistema.**
6. Comprueba la instalación en PowerShell:

   ```powershell
   docker --version
   docker compose version
   ```

   Si dicen que *no se reconoce*, cierra y abre PowerShell, o reinicia el computador.

### 1.4 Permiso de scripts en PowerShell

Evita el error *«la ejecución de scripts está deshabilitada»* al usar `npm`. Ejecútalo **una sola vez** y responde `S` si pide confirmación:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

---

## Parte 2 · Obtener el proyecto

Elige una de estas dos formas:

- **Sin Git (la más simple):** en la página del repositorio pulsa **Code → Download ZIP**. Luego haz clic derecho sobre el archivo
  descargado, elige **Extraer todo…** y pulsa **Extraer**.
- **Con Git:** si lo tienes instalado, ejecuta `git clone <URL-del-repositorio>`.

> **Atención con las carpetas repetidas.** Al extraer, puede quedar una carpeta dentro de otra con el mismo nombre.
> La carpeta correcta es la que contiene las dos carpetas del proyecto (`Backend` y `Frontend`).
> Si tienes copias viejas del proyecto, bórralas o renómbralas para no confundirte de carpeta.

**Cómo abrir PowerShell en la carpeta correcta.** Entra a la carpeta en el Explorador de archivos, haz clic en la barra de direcciones,
escribe `powershell` y pulsa Enter. Se abrirá PowerShell ya ubicado ahí. También puedes moverte con `cd`:

```powershell
cd C:\Users\TU_USUARIO\Downloads\raiz
dir
```

Cambia `TU_USUARIO` y la ruta por las tuyas. Con `dir` debes ver las carpetas `Backend` y `Frontend`.

> Escribe los comandos **de uno en uno**. Si pegas varias líneas, Windows muestra una advertencia: es normal, puedes aceptarla.

---

## Parte 3 · Encender el backend

Abre una ventana de PowerShell en la carpeta del proyecto (la de la Parte 2).

1. Entra a la carpeta del backend:

   ```powershell
   cd Backend
   ```

2. Comprueba que estás en el lugar correcto:

   ```powershell
   dir
   ```

   Debes ver `docker-compose.yml`, `Dockerfile`, `package.json`, `src`, `db` y `scripts`.
   Si no los ves, estás en la carpeta equivocada (prueba entrando a otra carpeta interna con `cd Backend`).

3. Asegúrate de que **Docker Desktop esté abierto** y diga **Engine running**.

4. Levanta todo:

   ```powershell
   docker compose up --build
   ```

5. **Espera.** La primera vez tarda varios minutos porque descarga PostgreSQL y construye la API. Verás muchos mensajes: es normal.

6. Está listo cuando aparezca una línea parecida a:

   ```
   API Eco Turismo escuchando en el puerto 3000
   ```

7. **No cierres esta ventana.** Si la cierras, el backend se apaga.

8. Comprueba que responde: abre en el navegador <http://localhost:3000/health>. Debe mostrar algo como `{"status":"ok", ...}`.

---

## Parte 4 · Cargar los datos de prueba (una sola vez)

Esto crea las cuentas de prueba y los destinos de ejemplo.

1. Abre una **segunda ventana de PowerShell** (no cierres la del backend).
2. Entra a la carpeta del backend:

   ```powershell
   cd Backend
   ```

   (Si abriste PowerShell directamente en la carpeta del proyecto. Si no, usa la ruta completa, igual que en la Parte 2.)

3. Ejecuta:

   ```powershell
   docker compose exec api node scripts/seed.js --demo --force
   ```

4. Debe terminar con un mensaje que dice que los datos de demostración fueron cargados.
   Si dice que **ya estaban cargados**, también está bien.
5. Puedes cerrar esta segunda ventana.

Es seguro repetir este comando: no duplica datos.

---

## Parte 5 · Encender el frontend

Abre una **tercera ventana de PowerShell**.

1. Entra a la carpeta del frontend:

   ```powershell
   cd Frontend
   ```

2. Comprueba:

   ```powershell
   dir
   ```

   Debes ver `package.json`, `.env`, `index.html` y la carpeta `src`.

3. Instala las dependencias (solo la primera vez en esta carpeta; tarda uno o dos minutos):

   ```powershell
   npm install
   ```

4. Arranca la aplicación:

   ```powershell
   npm run dev
   ```

5. Aparecerá una dirección, normalmente <http://localhost:5173>. **No cierres esta ventana.**

### Revisar la conexión con el backend

En la carpeta del frontend hay un archivo `.env` que debe decir:

```
VITE_API_URL=http://localhost:3000/api
```

Si tu backend usa otro puerto, cambia el número aquí y vuelve a ejecutar `npm run dev`.

---

## Parte 6 · Ingresar a la aplicación

Abre en el navegador <http://localhost:5173> e inicia sesión con una de estas cuentas:

| Rol | Qué verás | Correo | Contraseña |
| --- | --- | --- | --- |
| **Turista** | La app para buscar y reservar | `turista@demo.test` | `Demo12345` |
| **Anfitrión** | El panel para publicar y gestionar | `anfitrion@demo.test` | `Demo12345` |
| **Administrador** | El panel de moderación y reportes | `admin@ecoturismo.local` | `Admin12345` |

Cada cuenta te lleva automáticamente a su propia pantalla. También puedes crear una cuenta nueva con **Regístrate**,
eligiendo si eres turista, anfitrión o negocio local. Los datos de prueba también crean una cuenta de negocio local:
`negocio@demo.test` (contraseña `Demo12345`).

> Las contraseñas distinguen mayúsculas y minúsculas.
> Si la aplicación te lleva directo a una pantalla porque ya habías iniciado sesión antes, cierra sesión o abre la página en una ventana de incógnito.

---

## Parte 7 · Probar el flujo completo

Sigue este orden para ver todo funcionando:

1. **Entra como anfitrión.** En *Publicaciones*, crea una nueva, súbele una foto y en *Disponibilidad* define los cupos.
   **Sin cupos nadie puede reservar.**
2. **Cierra sesión y entra como turista.** Abre la publicación, toca **Reservar una visita**, elige fecha y personas, y continúa al pago.
3. En la pantalla de pago elige un medio (es una **pasarela simulada**: no se cobra dinero real) y paga. Revisa **Mis reservas**.
4. **Vuelve a entrar como anfitrión:** la reserva aparece en *Reservas*.
5. Como turista, abre la publicación y usa **Denunciar esta publicación**.
6. **Entra como administrador** y resuelve la denuncia en *Denuncias*. También puedes revisar el *Resumen*, los usuarios y las categorías.

---

## Uso diario (inicio rápido)

No necesitas repetir toda la guía. Solo haz esto:

1. Abre **Docker Desktop** y espera a que diga **Engine running**.
2. En PowerShell, dentro de la carpeta del backend:

   ```powershell
   docker compose up
   ```

3. En otra ventana de PowerShell, dentro de la carpeta del frontend:

   ```powershell
   npm run dev
   ```

4. Abre <http://localhost:5173>.

Tus usuarios, publicaciones, reservas y fotos se conservan entre un día y otro.
Si actualizas el código del backend, usa `docker compose up --build` una vez para reconstruirlo.

### Qué debe quedar abierto

- **Docker Desktop**, mostrando *Engine running*.
- **PowerShell 1:** el backend corriendo con `docker compose up`.
- **PowerShell 2:** el frontend corriendo con `npm run dev`.
- **El navegador** en <http://localhost:5173>.

### Cómo apagar

Pulsa **Ctrl + C** en cada ventana de PowerShell. Si quieres apagar el backend por completo, en la carpeta del backend ejecuta:

```powershell
docker compose down
```

> **Importante: nunca uses `docker compose down -v`.** La opción `-v` borra la base de datos y perderías usuarios, publicaciones,
> reservas y fotos. Si te pasa, vuelve a ejecutar el comando de datos de prueba de la [Parte 4](#parte-4--cargar-los-datos-de-prueba-una-sola-vez).

---

## Solución de problemas

| Si ves… | Qué pasa y cómo resolverlo |
| --- | --- |
| `docker` no se reconoce como comando | Docker Desktop no está instalado, o falta cerrar y abrir PowerShell (o reiniciar el computador). |
| `error during connect` o `daemon is not running` | Docker Desktop está cerrado. Ábrelo y espera a que diga *Engine running*. |
| Docker Desktop no inicia o pide WSL 2 o virtualización | Acepta la instalación de WSL 2 y reinicia el computador. Si persiste, activa la virtualización en la BIOS/UEFI del equipo. |
| `port is already allocated` (puerto 3000 o 5432) | Otro programa usa ese puerto. Cierra cualquier backend o PostgreSQL local que tengas corriendo, o una versión anterior de este proyecto. |
| `npm` o `node` no se reconocen | Falta instalar Node.js, o hay que abrir una ventana nueva de PowerShell después de instalarlo. |
| *«La ejecución de scripts está deshabilitada»* | Ejecuta el comando `Set-ExecutionPolicy` de la sección [1.4](#14-permiso-de-scripts-en-powershell) y repite. |
| Vite abre en el puerto 5174 en lugar de 5173 | Hay otro frontend encendido. Ciérralo con **Ctrl + C**, o agrega el puerto nuevo a `CORS_ORIGINS` (ver más abajo). |
| *«No pudimos conectar con el servidor»* | El backend está apagado o el puerto del archivo `.env` no coincide. Revisa <http://localhost:3000/health>. |
| Error de CORS en la consola del navegador (tecla **F12**) | El puerto del frontend no está permitido en `CORS_ORIGINS` del backend. Agrégalo y reinicia el backend (ver más abajo). |
| *Explorar* aparece vacío | Falta cargar los datos de prueba ([Parte 4](#parte-4--cargar-los-datos-de-prueba-una-sola-vez)). |
| *«Correo o contraseña incorrectos»* con una cuenta demo | Falta cargar los datos de prueba, o la contraseña está mal escrita (distingue mayúsculas). |
| `Failed to resolve import "axios"` o `"vue-router"` | Falta ejecutar `npm install` dentro de la carpeta del frontend. |
| Entro como turista y no veo el panel de anfitrión | Es lo esperado: cada rol ve su propia pantalla. Cierra sesión y entra con otra cuenta. |
| El calendario de reserva no deja elegir días | La publicación no tiene cupos. Entra como anfitrión y defínelos en *Disponibilidad*, o usa los destinos de ejemplo. |

### Cómo agregar un puerto a `CORS_ORIGINS`

1. Detén el backend con **Ctrl + C** en su ventana.
2. Abre `Backend\docker-compose.yml` con el Bloc de notas y busca esta línea:

   ```yaml
   CORS_ORIGINS: ${CORS_ORIGINS:-http://localhost:5173,http://localhost:8080}
   ```

3. Agrega el nuevo origen al final, separado por coma. Por ejemplo, para el puerto 5174:

   ```yaml
   CORS_ORIGINS: ${CORS_ORIGINS:-http://localhost:5173,http://localhost:8080,http://localhost:5174}
   ```

4. Guarda el archivo y vuelve a ejecutar `docker compose up` en la carpeta del backend.

**Si nada de esto resuelve el problema**, copia el mensaje exacto de PowerShell o de la consola del navegador
(**F12**, pestaña *Console*) para poder diagnosticarlo.

---

## Documentación técnica

Para quienes quieran ir más allá del paso a paso (carpeta `Backend`):

- `README.md` del backend: arquitectura, variables de entorno, reglas de negocio, seguridad y pruebas automáticas.
- `docs/API.md`: referencia de los 57 endpoints.
- `docs/TRAZABILIDAD.md`: de cada requisito (RF y RNF) a su implementación y su prueba.
- `docs/ecoturismo.postman_collection.json`: colección para probar la API en Postman.

---

## macOS y Linux

Los pasos son los mismos, con estas diferencias:

- Descarga Docker Desktop para [Mac](https://www.docker.com/products/docker-desktop/) (Apple Silicon o Intel) o sigue la
  [guía para Linux](https://docs.docker.com/desktop/linux/install/), y el instalador de Node.js 26.13.1 para tu sistema desde su
  [página de descarga](https://nodejs.org/en/blog/release/v26.13.1).
- Usa la Terminal en lugar de PowerShell y rutas con `/` (por ejemplo, `cd ~/Downloads/raiz`).
- No necesitas el paso 1.4 (permiso de scripts).
