## Español

### Agregado

- Archivo `SHA256SUMS.txt` para verificar la descarga del ejecutable.
- Proceso de release que prueba el ejecutable empaquetado desde una carpeta de trabajo distinta antes de publicarlo.

### Cambiado

- El ejecutable solicita y valida las credenciales de IOL antes de mostrar el selector de instrumentos.
- Las preferencias, la caché de símbolos, la última selección, los logs y las exportaciones del ejecutable se guardan en `%LOCALAPPDATA%\ScriptIOLExcel\`.
- Axios se actualizó a 1.19.0 para incorporar sus correcciones de seguridad disponibles.

### Corregido

- Una contraseña inválida ya no se guarda en el Almacén de Credenciales de Windows.
- El usuario de IOL se conserva de forma no secreta para poder recuperar la contraseña guardada en ejecuciones posteriores.
- Actualizar la lista de símbolos reutiliza la sesión autenticada y conserva la caché actualizada al navegar por el menú.
- Las selecciones de símbolos obsoletas ya no se envían a la API.

### Instalación

1. Descargar `ScriptIOLExcel.exe` y `SHA256SUMS.txt` de los archivos adjuntos a esta release.
2. Comparar el SHA-256 de `ScriptIOLExcel.exe` con `SHA256SUMS.txt`.
3. La versión no está firmada digitalmente: verificar que se descargó desde este repositorio antes de continuar ante una advertencia de Windows.
4. Ejecutar `ScriptIOLExcel.exe` y seguir el inicio de sesión de IOL.

---

## English

### Added

- `SHA256SUMS.txt` file for executable download verification.
- Release process that tests the packaged executable from a separate working directory before publishing it.

### Changed

- The executable now requests and validates IOL credentials before showing instrument selection.
- Executable preferences, symbol cache, last selection, logs, and exports are stored in `%LOCALAPPDATA%\ScriptIOLExcel\`.
- Axios was updated to 1.19.0 to incorporate its available security fixes.

### Fixed

- An invalid password is no longer saved to the Windows Credential Manager.
- The non-secret IOL username is retained so a saved password can be recovered on future runs.
- Updating the symbol list reuses the authenticated session and retains the refreshed cache while navigating the menu.
- Stale symbol selections are no longer sent to the API.

### Installation

1. Download `ScriptIOLExcel.exe` and `SHA256SUMS.txt` from this release's assets.
2. Compare the SHA-256 of `ScriptIOLExcel.exe` with `SHA256SUMS.txt`.
3. This version is not digitally signed: verify it came from this repository before proceeding past a Windows warning.
4. Run `ScriptIOLExcel.exe` and follow the IOL sign-in flow.
