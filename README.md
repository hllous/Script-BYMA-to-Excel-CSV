<a name="top"></a>
<div align="center">

# 📈 Convertidor de Cotizaciones de BYMA a Excel/CSV

**Exportador de cotizaciones del mercado BYMA, obtenidas a través de la API de InvertirOnline (IOL), a Excel y/o CSV.**

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)

<a href="#espanol"><img src="https://flagcdn.com/w40/es.png" width="28" alt="ES"> <b>Español</b></a>
&nbsp;&nbsp;&nbsp;
<a href="#english"><img src="https://flagcdn.com/w40/gb.png" width="28" alt="GB"> <b>English</b></a>

</div>

---

<a name="espanol"></a>
## 🇪🇸 Español

### 📑 Índice

- [Características](#-características)
- [Requisitos](#-requisitos)
- [Ejecutable standalone (.exe) — recomendado](#-ejecutable-standalone-exe--recomendado)
- [Para desarrollo](#-para-desarrollo)
- [Modo Fácil (`run.bat`)](#-modo-fácil-runbat)
- [Modo Avanzado (línea de comandos)](#-modo-avanzado-línea-de-comandos)
- [Archivos de salida](#-archivos-de-salida)
- [Notas y limitaciones](#-notas-y-limitaciones)
- [Licencia](#-licencia)

### ✨ Características

- 🔄 Obtiene cotizaciones directamente desde la **API de IOL** — sin scraping
- 📊 Exporta a **CSV** y/o **XLSX**, incluso ambos a la vez
- 🧩 Soporta todos los tipos de instrumentos que ofrece IOL: `acciones`, `cedears`, `letras`, `bonos`, `ons`, `fci`, `etfs`, `opciones`
- ⚙️ Totalmente configurable vía flags de CLI
- 🚀 Descarga concurrente y paginada, con reintentos y timeouts para mayor confiabilidad
- 🧾 Cada corrida genera un log y una auditoría en JSON junto con los datos
- 🖱️ Flujo sin terminal disponible — con solo hacer doble click en `run.bat`
- 🛡️ Continúa la ejecución aunque falle un símbolo individual, en lugar de frenar todo

### 📋 Requisitos

- **Windows**
- Una cuenta de **IOL (InvertirOnline)** con credenciales válidas

### 📦 Ejecutable standalone (.exe) — recomendado

Para usar el programa, recomendamos el ejecutable: no requiere instalar Node.js ni ejecutar comandos.

1. Descargar **`ScriptIOLExcel.exe`** de la última [release](https://github.com/hllous/Script-BYMA-to-Excel-CSV/releases/latest)
2. Hacer doble clic en el archivo descargado. Windows puede mostrar una advertencia porque esta versión no tiene firma digital; verificar que se descargó desde este repositorio antes de continuar.
3. En el menú inicial, elegir **Configuración** para cambiar la carpeta de salida, activar o desactivar las carpetas por fecha (`[ON/OFF]`) o eliminar los datos locales.
4. En la primera ejecución, iniciar sesión en IOL; después seleccionar instrumentos, formato y nombre de salida. El selector de formatos usa **Espacio** para elegir uno y **Enter** para continuar.
5. Por defecto, los CSV/XLSX se guardan en **`%LOCALAPPDATA%\ScriptIOLExcel\output\`** y los logs/auditorías en **`%LOCALAPPDATA%\ScriptIOLExcel\diagnostics\`**.

El menú de instrumentos permite volver al menú principal o salir. Después de una exportación también se puede volver al selector, volver al menú principal, cerrar sesión o salir. Se pide confirmación antes de eliminar `%LOCALAPPDATA%\ScriptIOLExcel\`. Si se eligió otra carpeta de salida, se pregunta por separado si también se desea eliminarla.

### 🛠 Para desarrollo

Para desarrollar o ejecutar desde el repositorio se necesita **Node.js 18 o superior** ([descargar acá](https://nodejs.org/)).

```bash
git clone https://github.com/hllous/Script-BYMA-to-Excel-CSV.git
cd Script-BYMA-to-Excel-CSV
npm install
```

#### 🟢 Modo Fácil (`run.bat`)

1. Hacer doble clic en el archivo **`run.bat`**
2. Ingresar y validar el usuario y la contraseña de IOL cuando se soliciten
3. Confirmar o cambiar la carpeta de salida que se muestra antes del selector. La carpeta elegida queda guardada para la próxima ejecución.
4. Si ya se usó el selector antes, elegir si se reutiliza, modifica o reemplaza la última selección de instrumentos
5. Seleccionar instrumentos en el menú (marcar categorías enteras como "Acciones" o "Bonos", "Todos", o "Custom" para elegir símbolos específicos)
6. Si se eligió "Custom", buscar y marcar símbolos puntuales en el selector buscable (hay una opción para actualizar la lista de símbolos desde IOL)
7. Elegir el formato de salida (CSV + XLSX, solo CSV o solo XLSX) y, si se desea, cambiar el nombre base del archivo. Un nombre existente se reemplaza.
8. Esperar a que finalice el proceso (tarda unos segundos, según la cantidad de instrumentos exportados). Al finalizar se muestran las rutas exactas de todos los archivos generados.

#### 🔵 Modo Avanzado (línea de comandos)

Para quienes prefieren trabajar desde la terminal y personalizar la exportación mediante parámetros.

```bash
npm start -- --instrumentos=all
```

Con filtros:

```bash
node src/appRunner.js --instrumentos=acciones,cedears,bonos --pais=argentina --panel=general --formato=both
```

> Pasar `--instrumentos` y/o `--formato` por CLI evita el selector interactivo (picker de símbolos, reutilizar última selección, paso de formato) y va directo a la corrida, igual que antes del selector.

Ver todas las opciones disponibles:

```bash
npm run help
```

**Parámetros disponibles:**

| Parámetro | Descripción | Ejemplo / Valores |
|---|---|---|
| `--instrumentos` | Tipos de instrumentos a obtener (evita el selector interactivo) | `all` o `acciones,cedears,letras,bonos,ons,fci,etfs,opciones` |
| `--pais` | Mercado/país | `argentina` |
| `--panel` | Panel de mercado | `general` |
| `--formato` | Formato de salida (evita el selector interactivo) | `both`, `csv`, `xlsx` |
| `--salida` | Carpeta de salida | `output` |
| `--pageSize` | Resultados por página | `100` |
| `--maxPages` | Páginas máximas por instrumento | `200` |
| `--concurrency` | Requests en paralelo | `5` |
| `--timeoutMs` | Timeout de request (ms) | `20000` |
| `--retries` | Reintentos por request fallido | `3` |
| `--interactive` | Habilita el selector interactivo y los prompts de credenciales faltantes | `true` / `false` |

### 📂 Archivos de salida

Cada corrida genera:

```
output/
├── byma-acciones-YYYY-MM-DD-HH-mm.csv
└── byma-acciones-YYYY-MM-DD-HH-mm.xlsx

diagnostics/
├── byma-acciones-YYYY-MM-DD-HH-mm-audit.json
└── byma-acciones-YYYY-MM-DD-HH-mm.log
```

En el ejecutable, **Configuración → Guardar archivos en carpetas por fecha** organiza los CSV/XLSX en `output/YYYY-MM-DD/`. Al elegir un nombre base personalizado (sin extensión), se reemplaza el CSV y/o XLSX de igual nombre dentro de la carpeta de salida activa.

### 📝 Notas y limitaciones

- El script continúa aunque haya errores en símbolos individuales — se registran en el log, no interrumpen la corrida.
- Si IOL cambia sus endpoints o la estructura de respuesta, puede ser necesario ajustar los mapeos en `src/services`.
- Es una **herramienta no oficial, de uso personal**, sin afiliación ni respaldo de IOL/InvertirOnline o BYMA. Su uso debe ajustarse a los términos de servicio de la API de IOL.

### 📄 Licencia

Publicado bajo la [Licencia MIT](LICENSE).

<div align="right">

[⬆️ Volver arriba](#top) · [🇬🇧 Ir a English](#english)

</div>

---

<a name="english"></a>
## 🇬🇧 English

### 📑 Table of Contents

- [Features](#-features)
- [Requirements](#-requirements)
- [Standalone .exe — recommended](#-standalone-exe--recommended)
- [For developers](#-for-developers)
- [Easy Mode (`run.bat`)](#-easy-mode-runbat)
- [Advanced Mode (command line)](#-advanced-mode-command-line)
- [Output Files](#-output-files)
- [Notes & Limitations](#-notes--limitations)
- [License](#-license)

### ✨ Features

- 🔄 Fetches live quotes directly from the **IOL API** — no scraping involved
- 📊 Exports to **CSV** and/or **XLSX**, simultaneously if you want
- 🧩 Supports every instrument type IOL offers: `acciones`, `cedears`, `letras`, `bonos`, `ons`, `fci`, `etfs`, `opciones`
- ⚙️ Fully configurable via CLI flags
- 🚀 Concurrent, paginated fetching with retries and timeouts for reliability
- 🧾 Every run produces an audit log and a JSON audit trail alongside your data
- 🖱️ Zero-terminal workflow available — just double-click `run.bat`
- 🛡️ Keeps going even if individual symbols fail, instead of crashing the whole run

### 📋 Requirements

- **Windows**
- An **IOL (InvertirOnline)** account with valid credentials

### 📦 Standalone .exe — recommended

For using the program, we recommend the executable: it needs neither Node.js nor command-line setup.

1. Download **`ScriptIOLExcel.exe`** from the latest [release](https://github.com/hllous/Script-BYMA-to-Excel-CSV/releases/latest)
2. Double-click the downloaded file. Windows may show a warning because this version is not digitally signed; verify it came from this repository before continuing.
3. From the startup menu, choose **Configuración** to change the output folder, toggle date folders (`[ON/OFF]`), or remove local data.
4. On the first run, sign in to IOL; then choose instruments, an output format, and an output name. The format picker uses **Space** to select one option and **Enter** to continue.
5. By default, CSV/XLSX files are saved under **`%LOCALAPPDATA%\ScriptIOLExcel\output\`**, while logs and audits are saved under **`%LOCALAPPDATA%\ScriptIOLExcel\diagnostics\`**.

The instrument menu lets the user return to the startup menu or exit. After an export, users can also return to the picker, return to the startup menu, log out, or exit. Confirmation is required before removing `%LOCALAPPDATA%\ScriptIOLExcel\`. If a different output folder was chosen, it is asked separately whether that folder should also be deleted.

### 🛠 For developers

To develop or run from the repository, install **Node.js 18 or higher** ([download here](https://nodejs.org/)).

```bash
git clone https://github.com/hllous/Script-BYMA-to-Excel-CSV.git
cd Script-BYMA-to-Excel-CSV
npm install
```

#### 🟢 Easy Mode (`run.bat`)

1. Double-click the **`run.bat`** file
2. Enter and validate your IOL username and password when prompted
3. Confirm or change the output folder shown before the picker. The chosen folder is retained for the next run.
4. If you've used the picker before, choose whether to reuse, edit, or replace the last selection
5. Pick instruments from the menu (check whole categories like "Acciones" or "Bonos", "Todos", or "Custom" to pick specific tickers instead)
6. If you picked "Custom", search and check specific tickers in the searchable picker (there's an option to refresh the symbol list from IOL)
7. Pick the output format (CSV + XLSX, CSV only, or XLSX only) and optionally change the output base name. An existing name is replaced.
8. Wait for the process to finish (a few seconds, depending on how many instruments are being exported). The exact path to every generated file is printed when it finishes.

#### 🔵 Advanced Mode (command line)

For anyone who prefers working from the command line and customizing the export with parameters.

```bash
npm start -- --instrumentos=all
```

With filters:

```bash
node src/appRunner.js --instrumentos=acciones,cedears,bonos --pais=argentina --panel=general --formato=both
```

> Passing `--instrumentos` and/or `--formato` on the CLI skips the interactive menu (symbol picker, last-selection reuse, format step) and runs directly, the same as before the picker existed.

Show all available options:

```bash
npm run help
```

**Available parameters:**

| Parameter | Description | Example / Values |
|---|---|---|
| `--instrumentos` | Instrument types to fetch (skips the interactive menu) | `all` or `acciones,cedears,letras,bonos,ons,fci,etfs,opciones` |
| `--pais` | Market/country | `argentina` |
| `--panel` | Market panel | `general` |
| `--formato` | Output format (skips the interactive menu) | `both`, `csv`, `xlsx` |
| `--salida` | Output folder | `output` |
| `--pageSize` | Results per page | `100` |
| `--maxPages` | Max pages to fetch per instrument | `200` |
| `--concurrency` | Parallel requests | `5` |
| `--timeoutMs` | Request timeout (ms) | `20000` |
| `--retries` | Retry attempts per failed request | `3` |
| `--interactive` | Enables the interactive menu and prompts for missing credentials | `true` / `false` |

### 📂 Output Files

Each run generates, per execution:

```
output/
├── byma-acciones-YYYY-MM-DD-HH-mm.csv
└── byma-acciones-YYYY-MM-DD-HH-mm.xlsx

diagnostics/
├── byma-acciones-YYYY-MM-DD-HH-mm-audit.json
└── byma-acciones-YYYY-MM-DD-HH-mm.log
```

In the executable, **Configuración → Guardar archivos en carpetas por fecha** places CSV/XLSX files under `output/YYYY-MM-DD/`. A custom base name (without an extension) replaces an existing CSV and/or XLSX with that name in the active output folder.

### 📝 Notes & Limitations

- The script keeps running even if individual symbols error out — failures are logged, not fatal.
- If IOL changes its API endpoints or response structure, mappings in `src/services` may need updating.
- This is an **unofficial, personal-use tool** and is not affiliated with or endorsed by IOL/InvertirOnline or BYMA. Use it in accordance with IOL's API terms of service.

### 📄 License

Released under the [MIT License](LICENSE).

<div align="right">

[⬆️ Back to top](#top) · [🇪🇸 Ir a Español](#espanol)

</div>
