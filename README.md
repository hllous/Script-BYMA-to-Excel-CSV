<a name="top"></a>
<div align="center">

# 📈 BYMA Quote Exporter (vía API de IOL)

**Herramienta liviana en Node.js que exporta cotizaciones del mercado BYMA, obtenidas a través de la API de InvertirOnline (IOL), directamente a CSV y XLSX.**

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)

[![Español](https://img.shields.io/badge/🇪🇸-Español-D14836?style=for-the-badge)](#espanol)
[![English](https://img.shields.io/badge/🇬🇧-English-0077B5?style=for-the-badge)](#english)

</div>

---

<a name="espanol"></a>
## 🇪🇸 Español

Nada de copiar y pegar a mano desde la web del broker, ni pelear con exportaciones de Excel: apuntá a los instrumentos que te interesan (acciones, CEDEARs, bonos, ETFs, opciones y más) y obtené planillas limpias y listas para usar en segundos.

### 📑 Índice

- [Características](#-características)
- [Requisitos](#-requisitos)
- [Instalación](#-instalación)
- [Inicio rápido (doble click)](#-inicio-rápido-doble-click)
- [Uso por terminal](#-uso-por-terminal)
- [Parámetros de la CLI](#-parámetros-de-la-cli)
- [Configuración](#-configuración)
- [Archivos de salida](#-archivos-de-salida)
- [Notas y limitaciones](#-notas-y-limitaciones)
- [Licencia](#-licencia)

### ✨ Características

- 🔄 Obtiene cotizaciones directamente desde la **API de IOL** — sin scraping
- 📊 Exporta a **CSV** y/o **XLSX**, incluso ambos a la vez
- 🧩 Soporta todos los tipos de instrumentos que ofrece IOL: `acciones`, `cedears`, `letras`, `bonos`, `ons`, `fci`, `etfs`, `opciones`
- ⚙️ Totalmente configurable vía flags de CLI o un archivo de configuración local
- 🚀 Descarga concurrente y paginada, con reintentos y timeouts para mayor confiabilidad
- 🧾 Cada corrida genera un log y una auditoría en JSON junto con los datos
- 🖱️ Flujo sin terminal disponible — con solo hacer doble click en `run.bat`
- 🛡️ Continúa la ejecución aunque falle un símbolo individual, en lugar de frenar todo

### 📋 Requisitos

- **Windows**, con **Node.js 18 o superior** instalado ([descargar acá](https://nodejs.org/))
- Una cuenta de **IOL (InvertirOnline)** con credenciales válidas

### 🛠 Instalación

```bash
git clone https://github.com/hllous/Script-BYMA-to-Excel-CSV.git
cd Script-BYMA-to-Excel-CSV
npm install
```

### 🖱 Inicio rápido (doble click)

La forma más simple de correrlo, sin necesidad de terminal:

1. Hacer doble click en **`run.bat`**
2. Ingresar usuario/contraseña de IOL cuando lo pida (se salta si ya están en `config.local.json`)
3. Buscar los archivos generados en la carpeta **`output/`** al finalizar

### 💻 Uso por terminal

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

### ⚙️ Parámetros de la CLI

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

### 🔧 Configuración

Para evitar el prompt interactivo de credenciales, copiá el archivo de ejemplo y completá tus propios valores:

```bash
cp config.local.example.json config.local.json
```

```json
{
  "username": "TU_USUARIO_IOL",
  "password": "TU_PASSWORD_IOL",
  "apiBaseUrl": "https://api.invertironline.com/api/v2",
  "authUrl": "https://api.invertironline.com/token",
  "pais": "argentina",
  "panel": "general",
  "formatos": ["csv", "xlsx"],
  "instrumentos": ["acciones", "cedears", "bonos"],
  "salida": "output",
  "pageSize": 100,
  "maxPages": 200,
  "concurrency": 5,
  "timeoutMs": 20000,
  "retries": 3
}
```

> ⚠️ **Nota de seguridad:** `config.local.json` está listado en `.gitignore` y nunca se commitea — es intencional. Contiene tus credenciales reales de IOL, así que mantenelo así y nunca lo subas ni lo compartas.

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
- Es una **herramienta no oficial, de uso personal**, sin afiliación ni respaldo de IOL/InvertirOnline o BYMA. Usala de acuerdo a los términos de servicio de la API de IOL.

### 📄 Licencia

Publicado bajo la [Licencia MIT](LICENSE).

<div align="right">

[⬆️ Volver arriba](#top) · [🇬🇧 Ir a English](#english)

</div>

---

<a name="english"></a>
## 🇬🇧 English

No manual copy-pasting from a broker's website, no fighting with Excel exports — point it at the instruments you care about (stocks, CEDEARs, bonds, ETFs, options, and more) and get clean, ready-to-use spreadsheets in seconds.

### 📑 Table of Contents

- [Features](#-features)
- [Requirements](#-requirements)
- [Installation](#-installation)
- [Quick Start](#-quick-start-double-click)
- [Usage from the Terminal](#-usage-from-the-terminal)
- [CLI Parameters](#-cli-parameters)
- [Configuration](#-configuration)
- [Output Files](#-output-files)
- [Notes & Limitations](#-notes--limitations)
- [License](#-license)

### ✨ Features

- 🔄 Fetches live quotes directly from the **IOL API** — no scraping involved
- 📊 Exports to **CSV** and/or **XLSX**, simultaneously if you want
- 🧩 Supports every instrument type IOL offers: `acciones`, `cedears`, `letras`, `bonos`, `ons`, `fci`, `etfs`, `opciones`
- ⚙️ Fully configurable via CLI flags or a local config file
- 🚀 Concurrent, paginated fetching with retries and timeouts for reliability
- 🧾 Every run produces an audit log and a JSON audit trail alongside your data
- 🖱️ Zero-terminal workflow available — just double-click `run.bat`
- 🛡️ Keeps going even if individual symbols fail, instead of crashing the whole run

### 📋 Requirements

- **Windows**, with **Node.js 18 or higher** installed ([download here](https://nodejs.org/))
- An **IOL (InvertirOnline)** account with valid credentials

### 🛠 Installation

```bash
git clone https://github.com/hllous/Script-BYMA-to-Excel-CSV.git
cd Script-BYMA-to-Excel-CSV
npm install
```

### 🖱 Quick Start (double-click)

The simplest way to run it, no terminal required:

1. Double-click **`run.bat`**
2. Enter your IOL username/password when prompted (skipped if already set in `config.local.json`)
3. Grab your files from the **`output/`** folder once it finishes

### 💻 Usage from the Terminal

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

### ⚙️ CLI Parameters

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

### 🔧 Configuration

To skip the interactive credential prompt, copy the example config and fill in your own values:

```bash
cp config.local.example.json config.local.json
```

```json
{
  "username": "TU_USUARIO_IOL",
  "password": "TU_PASSWORD_IOL",
  "apiBaseUrl": "https://api.invertironline.com/api/v2",
  "authUrl": "https://api.invertironline.com/token",
  "pais": "argentina",
  "panel": "general",
  "formatos": ["csv", "xlsx"],
  "instrumentos": ["acciones", "cedears", "bonos"],
  "salida": "output",
  "pageSize": 100,
  "maxPages": 200,
  "concurrency": 5,
  "timeoutMs": 20000,
  "retries": 3
}
```

> ⚠️ **Security note:** `config.local.json` is listed in `.gitignore` and is never committed — that's intentional. It holds your real IOL credentials, so keep it that way and never commit or share it.

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
