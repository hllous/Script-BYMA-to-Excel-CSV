## Español

### Agregado

- Elección de carpeta de salida antes de seleccionar instrumentos; la opción queda guardada para próximas ejecuciones.
- Opción `ScriptIOLExcel.exe --uninstall` para eliminar los datos locales de la aplicación, con confirmación independiente para una carpeta de salida personalizada.

### Cambiado

- La carpeta de salida contiene únicamente exportaciones CSV/XLSX. Logs y auditorías JSON se guardan por separado en `%LOCALAPPDATA%\ScriptIOLExcel\diagnostics\`.
- Los nombres de archivo usan el formato local legible `YYYY-MM-DD-HH-mm` y agregan un sufijo numérico si dos corridas coinciden en el mismo minuto.

### Corregido

- Las exportaciones ya no pueden sobrescribirse cuando se inicia más de una corrida con los mismos instrumentos en el mismo minuto.

### Instalación

1. Descargar `ScriptIOLExcel.exe` y `SHA256SUMS.txt` de los archivos adjuntos a esta release.
2. Comparar el SHA-256 de `ScriptIOLExcel.exe` con `SHA256SUMS.txt`.
3. Esta versión no está firmada digitalmente: verificar que se descargó desde este repositorio antes de continuar ante una advertencia de Windows.
4. Ejecutar `ScriptIOLExcel.exe` y seguir el inicio de sesión de IOL.

---

## English

### Added

- Output-folder selection before instrument selection; the choice is retained for future runs.
- `ScriptIOLExcel.exe --uninstall` option to remove local application data, with a separate confirmation for a custom output directory.

### Changed

- The output folder contains CSV/XLSX exports only. Logs and JSON audits are stored separately under `%LOCALAPPDATA%\ScriptIOLExcel\diagnostics\`.
- File names use the readable local `YYYY-MM-DD-HH-mm` format and add a numeric suffix when two runs share the same minute.

### Fixed

- Exports can no longer be overwritten when more than one run with the same instruments starts in the same minute.

### Installation

1. Download `ScriptIOLExcel.exe` and `SHA256SUMS.txt` from this release's assets.
2. Compare the SHA-256 of `ScriptIOLExcel.exe` with `SHA256SUMS.txt`.
3. This version is not digitally signed: verify it came from this repository before proceeding past a Windows warning.
4. Run `ScriptIOLExcel.exe` and follow the IOL sign-in flow.
