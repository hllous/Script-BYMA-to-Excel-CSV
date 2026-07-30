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
- [Modo Fácil](#-modo-fácil)
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

### 🟢 Modo Fácil (sin línea de comandos)

1. Hacer doble clic en el archivo **`run.bat`**
2. Ingresar el usuario y la contraseña de IOL cuando se soliciten
3. Esperar a que finalice el proceso (tarda unos segundos, según la cantidad de instrumentos exportados)
4. Abrir la carpeta **`output/`**, donde quedan los archivos CSV y/o Excel generados

### 🔵 Modo Avanzado (línea de comandos)

Para quienes prefieren trabajar desde la terminal y personalizar la exportación mediante parámetros.

```bash
npm start -- --instrumentos=all
```

Con filtros:

```bash
node src/appRunner.js --instrumentos=acciones,cedears,bonos --pais=argentina --panel=general --formato=both
```

Ver todas las opciones disponibles:

```bash
npm run help
```

**Parámetros disponibles:**

| Parámetro | Descripción | Ejemplo / Valores |
|---|---|---|
| `--instrumentos` | Tipos de instrumentos a obtener | `all` o `acciones,cedears,letras,bonos,ons,fci,etfs,opciones` |
| `--pais` | Mercado/país | `argentina` |
| `--panel` | Panel de mercado | `general` |
| `--formato` | Formato de salida | `both`, `csv`, `xlsx` |
| `--salida` | Carpeta de salida | `output` |
| `--pageSize` | Resultados por página | `100` |
| `--maxPages` | Páginas máximas por instrumento | `200` |
| `--concurrency` | Requests en paralelo | `5` |
| `--timeoutMs` | Timeout de request (ms) | `20000` |
| `--retries` | Reintentos por request fallido | `3` |
| `--interactive` | Preguntar por credenciales faltantes | `true` / `false` |

### 📂 Archivos de salida

Cada corrida genera:

```
output/
├── byma-<timestamp>.csv
├── byma-<timestamp>.xlsx
├── byma-<timestamp>-audit.json
└── byma-<timestamp>.log
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
- [Easy Mode](#-easy-mode)
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

### 🟢 Easy Mode (no command line)

1. Double-click the **`run.bat`** file
2. Enter your IOL username and password when prompted
3. Wait for the process to finish (a few seconds, depending on how many instruments are being exported)
4. Open the **`output/`** folder, where the generated CSV and/or Excel files are saved

### 🔵 Advanced Mode (command line)

For anyone who prefers working from the command line and customizing the export with parameters.

```bash
npm start -- --instrumentos=all
```

With filters:

```bash
node src/appRunner.js --instrumentos=acciones,cedears,bonos --pais=argentina --panel=general --formato=both
```

Show all available options:

```bash
npm run help
```

**Available parameters:**

| Parameter | Description | Example / Values |
|---|---|---|
| `--instrumentos` | Instrument types to fetch | `all` or `acciones,cedears,letras,bonos,ons,fci,etfs,opciones` |
| `--pais` | Market/country | `argentina` |
| `--panel` | Market panel | `general` |
| `--formato` | Output format | `both`, `csv`, `xlsx` |
| `--salida` | Output folder | `output` |
| `--pageSize` | Results per page | `100` |
| `--maxPages` | Max pages to fetch per instrument | `200` |
| `--concurrency` | Parallel requests | `5` |
| `--timeoutMs` | Request timeout (ms) | `20000` |
| `--retries` | Retry attempts per failed request | `3` |
| `--interactive` | Prompt for missing credentials | `true` / `false` |

### 📂 Output Files

Each run generates, per execution:

```
output/
├── byma-<timestamp>.csv
├── byma-<timestamp>.xlsx
├── byma-<timestamp>-audit.json
└── byma-<timestamp>.log
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
