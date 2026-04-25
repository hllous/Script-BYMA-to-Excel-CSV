# Recolector BYMA con IOL API

Herramienta KISS en Node.js para exportar cotizaciones BYMA desde IOL a CSV y XLSX.

## Requisitos

- Windows con Node.js 18 o superior
- Credenciales de IOL

## Ejecucion para usuario final (doble click)

1. Hacer doble click en `run.bat`
2. Ingresar usuario/password cuando lo pida (si no estan en config)
3. Revisar archivos generados en la carpeta `output`

## Uso por terminal

```bash
npm install
npm start -- --instrumentos=all
```

Ejemplo con filtros:

```bash
node src/appRunner.js --instrumentos=acciones,cedears,bonos --pais=argentina --panel=general --formato=both
```

## Parametros principales

- `--instrumentos=all|acciones,cedears,letras,bonos,ons,fci,etfs,opciones`
- `--pais=argentina`
- `--panel=general`
- `--formato=both|csv|xlsx`
- `--salida=output`
- `--pageSize=100`
- `--maxPages=200`
- `--concurrency=5`
- `--timeoutMs=20000`
- `--retries=3`
- `--interactive=true|false`

## Configuracion opcional

Crear un archivo `config.local.json` en la raiz para evitar prompts interactivos.

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

## Salidas

Por corrida se generan archivos:

- `output/byma-<timestamp>.csv`
- `output/byma-<timestamp>.xlsx`
- `output/byma-<timestamp>-audit.json`
- `output/byma-<timestamp>.log`

## Notas

- El script continua por simbolo aunque haya errores individuales.
- Si un campo no aplica para un tipo de instrumento, se exporta en `null`.
- Si IOL cambia endpoints o estructura de respuesta, puede requerir ajustar mapeos en `src/services`.
