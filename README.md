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
- [Instalación](#-instalación)
- [Configuración opcional](#️-configuración-opcional)
- [Modo Fácil](#-modo-fácil)
- [Ejecutable standalone (.exe)](#-ejecutable-standalone-exe)
- [Modo Avanzado](#-modo-avanzado)
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

- **Windows**, con **Node.js 18 o superior** instalado ([descargar acá](https://nodejs.org/))
- Una cuenta de **IOL (InvertirOnline)** con credenciales válidas

### 🛠 Instalación

Este paso es necesario tanto para el Modo Fácil como para el Modo Avanzado.

```bash
git clone https://github.com/hllous/Script-BYMA-to-Excel-CSV.git
cd Script-BYMA-to-Excel-CSV
npm install
```

### ⚙️ Configuración opcional

Para no ingresar el usuario de IOL en cada corrida, copiar `config.local.example.json` como `config.local.json` y completar el usuario y los valores por defecto:

```bash
cp config.local.example.json config.local.json
```

`config.local.json` está en `.gitignore` y nunca se sube al repositorio. La contraseña **no** se guarda en este archivo: se pide una vez de forma enmascarada y, si se acepta, queda guardada en el almacén de credenciales de Windows para las próximas corridas.

### 🟢 Modo Fácil (sin línea de comandos)

1. Hacer doble clic en el archivo **`run.bat`**
2. Ingresar y validar el usuario y la contraseña de IOL cuando se soliciten
3. Confirmar o cambiar la carpeta de salida que se muestra antes del selector. La carpeta elegida queda guardada para la próxima ejecución.
4. Si ya se usó el selector antes, va a preguntar si se desea reutilizar la última selección de instrumentos
5. Seleccionar instrumentos en el menú (marcar categorías enteras como "Acciones" o "Bonos", "Todos", o "Custom" para elegir símbolos específicos)
6. Si se eligió "Custom", buscar y marcar símbolos puntuales en el selector buscable (hay una opción para actualizar la lista de símbolos desde IOL)
7. Elegir el formato de salida (CSV + XLSX, solo CSV o solo XLSX)
8. Esperar a que finalice el proceso (tarda unos segundos, según la cantidad de instrumentos exportados). Al finalizar se muestran las rutas exactas de todos los archivos generados.

### 📦 Ejecutable standalone (.exe)

Para quienes prefieren no instalar Node.js: en la sección [Releases](https://github.com/hllous/Script-BYMA-to-Excel-CSV/releases/latest) del repositorio hay un ejecutable de Windows listo para usar.

1. Descargar **`ScriptIOLExcel.exe`** de la última release
2. Comparar el SHA-256 del archivo con `SHA256SUMS.txt` publicado en la release
3. Hacer doble clic en el archivo descargado. Windows puede mostrar una advertencia porque esta versión no tiene firma digital; verificar que se descargó desde este repositorio antes de continuar.
4. En la primera ejecución, iniciar sesión en IOL; después seleccionar instrumentos y formato de salida
5. Antes de seleccionar instrumentos, confirmar o cambiar la carpeta de salida. La ruta se muestra nuevamente junto a cada archivo generado.
6. Por defecto, los CSV/XLSX se guardan en **`%LOCALAPPDATA%\ScriptIOLExcel\output\`** y los logs/auditorías en **`%LOCALAPPDATA%\ScriptIOLExcel\diagnostics\`**.

Para eliminar los datos locales del ejecutable, abrir PowerShell en la carpeta del `.exe` y ejecutar:

```powershell
.\ScriptIOLExcel.exe --uninstall
```

Se pide confirmación antes de eliminar `%LOCALAPPDATA%\ScriptIOLExcel\`. Si se eligió otra carpeta de salida, se pregunta por separado si también se desea eliminarla.

No hace falta instalar Node.js ni ejecutar `npm install` — el `.exe` ya incluye todo lo necesario.

### 🔵 Modo Avanzado (línea de comandos)

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

### 📝 Notas y limitaciones

- El script continúa aunque haya errores en símbolos individuales — se registran en el log, no interrumpen la corrida.
- Si un campo no aplica para un tipo de instrumento, se exporta como `null`.
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
- [Installation](#-installation)
- [Optional Configuration](#️-optional-configuration)
- [Easy Mode](#-easy-mode)
- [Standalone .exe](#-standalone-exe)
- [Advanced Mode](#-advanced-mode)
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

- **Windows**, with **Node.js 18 or higher** installed ([download here](https://nodejs.org/))
- An **IOL (InvertirOnline)** account with valid credentials

### 🛠 Installation

This step is required for both Easy Mode and Advanced Mode.

```bash
git clone https://github.com/hllous/Script-BYMA-to-Excel-CSV.git
cd Script-BYMA-to-Excel-CSV
npm install
```

### ⚙️ Optional configuration

To avoid entering your IOL username on every run, copy `config.local.example.json` to `config.local.json` and fill in your username and default values:

```bash
cp config.local.example.json config.local.json
```

`config.local.json` is in `.gitignore` and is never committed to the repo. Your password is **not** stored in this file: it's requested once with masked input, and if you opt in, it's saved to the Windows credential store for future runs.

### 🟢 Easy Mode (no command line)

1. Double-click the **`run.bat`** file
2. Enter and validate your IOL username and password when prompted
3. Confirm or change the output folder shown before the picker. The chosen folder is retained for the next run.
4. If you've used the picker before, it'll ask whether you want to reuse your last selection
5. Pick instruments from the menu (check whole categories like "Acciones" or "Bonos", "Todos", or "Custom" to pick specific tickers instead)
6. If you picked "Custom", search and check specific tickers in the searchable picker (there's an option to refresh the symbol list from IOL)
7. Pick the output format (CSV + XLSX, CSV only, or XLSX only)
8. Wait for the process to finish (a few seconds, depending on how many instruments are being exported). The exact path to every generated file is printed when it finishes.

### 📦 Standalone .exe

If you'd rather not install Node.js at all, the [Releases](https://github.com/hllous/Script-BYMA-to-Excel-CSV/releases/latest) section of the repository has a ready-to-run Windows executable.

1. Download **`ScriptIOLExcel.exe`** from the latest release
2. Compare the file's SHA-256 with the `SHA256SUMS.txt` published with the release
3. Double-click the downloaded file. Windows may show a warning because this version is not digitally signed; verify it came from this repository before continuing.
4. On the first run, sign in to IOL; then choose instruments and an output format
5. Before choosing instruments, confirm or change the output folder. The path is shown again for every generated file.
6. By default, CSV/XLSX files are saved under **`%LOCALAPPDATA%\ScriptIOLExcel\output\`**, while logs and audits are saved under **`%LOCALAPPDATA%\ScriptIOLExcel\diagnostics\`**.

To remove the executable's local data, open PowerShell in the `.exe` folder and run:

```powershell
.\ScriptIOLExcel.exe --uninstall
```

It asks for confirmation before removing `%LOCALAPPDATA%\ScriptIOLExcel\`. If a different output folder was chosen, it asks separately whether that folder should also be deleted.

No Node.js install or `npm install` required — the `.exe` already bundles everything it needs.

### 🔵 Advanced Mode (command line)

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

### 📝 Notes & Limitations

- The script keeps running even if individual symbols error out — failures are logged, not fatal.
- Fields that don't apply to a given instrument type are exported as `null`.
- If IOL changes its API endpoints or response structure, mappings in `src/services` may need updating.
- This is an **unofficial, personal-use tool** and is not affiliated with or endorsed by IOL/InvertirOnline or BYMA. Use it in accordance with IOL's API terms of service.

### 📄 License

Released under the [MIT License](LICENSE).

<div align="right">

[⬆️ Back to top](#top) · [🇪🇸 Ir a Español](#espanol)

</div>
