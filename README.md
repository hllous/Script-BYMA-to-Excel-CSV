<div align="center">

# 📈 BYMA Quote Exporter (via IOL API)

**A lightweight Node.js tool that pulls live BYMA market quotes through the InvertirOnline (IOL) API and exports them straight to CSV and XLSX.**

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)

</div>

---

No manual copy-pasting from a broker's website, no fighting with Excel exports — point it at the instruments you care about (stocks, CEDEARs, bonds, ETFs, options, and more) and get clean, ready-to-use spreadsheets in seconds.

## 📑 Table of Contents

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

## ✨ Features

- 🔄 Fetches live quotes directly from the **IOL API** — no scraping involved
- 📊 Exports to **CSV** and/or **XLSX**, simultaneously if you want
- 🧩 Supports every instrument type IOL offers: `acciones`, `cedears`, `letras`, `bonos`, `ons`, `fci`, `etfs`, `opciones`
- ⚙️ Fully configurable via CLI flags or a local config file
- 🚀 Concurrent, paginated fetching with retries and timeouts for reliability
- 🧾 Every run produces an audit log and a JSON audit trail alongside your data
- 🖱️ Zero-terminal workflow available — just double-click `run.bat`
- 🛡️ Keeps going even if individual symbols fail, instead of crashing the whole run

## 📋 Requirements

- **Windows**, with **Node.js 18 or higher** installed ([download here](https://nodejs.org/))
- An **IOL (InvertirOnline)** account with valid credentials

## 🛠 Installation

```bash
git clone https://github.com/hllous/Script-BYMA-to-Excel-CSV.git
cd Script-BYMA-to-Excel-CSV
npm install
```

## 🖱 Quick Start (double-click)

The simplest way to run it, no terminal required:

1. Double-click **`run.bat`**
2. Enter your IOL username/password when prompted (skipped if already set in `config.local.json`)
3. Grab your files from the **`output/`** folder once it finishes

## 💻 Usage from the Terminal

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

## ⚙️ CLI Parameters

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

## 🔧 Configuration

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

## 📂 Output Files

Each run generates, per execution:

```
output/
├── byma-<timestamp>.csv
├── byma-<timestamp>.xlsx
├── byma-<timestamp>-audit.json
└── byma-<timestamp>.log
```

## 📝 Notes & Limitations

- The script keeps running even if individual symbols error out — failures are logged, not fatal.
- Fields that don't apply to a given instrument type are exported as `null`.
- If IOL changes its API endpoints or response structure, mappings in `src/services` may need updating.
- This is an **unofficial, personal-use tool** and is not affiliated with or endorsed by IOL/InvertirOnline or BYMA. Use it in accordance with IOL's API terms of service.

## 📄 License

Released under the [MIT License](LICENSE).
