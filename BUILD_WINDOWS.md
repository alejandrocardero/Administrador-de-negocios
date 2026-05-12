# Construir AdminNegocio Pro para Windows

Este documento explica cómo construir el archivo `.exe` para Windows.

## Opción 1: Construir en tu máquina Windows (Recomendado)

### Requisitos previos
- Node.js 18 o superior: https://nodejs.org/
- Git (opcional): https://git-scm.com/

### Pasos

1. **Descargar el código fuente**
   - Descarga el archivo ZIP con el código fuente
   - Extrae el contenido en una carpeta

2. **Abrir PowerShell o CMD como Administrador**
   - Navega a la carpeta del proyecto

3. **Instalar dependencias**
   ```powershell
   npm install
   ```

4. **Construir la aplicación**
   ```powershell
   npm run build
   ```

5. **Crear el ejecutable**
   ```powershell
   npm run dist
   ```

6. **Encontrar el .exe**
   - El instalador estará en: `release/AdminNegocio Pro Setup 1.0.0.exe`
   - O la versión portable en: `release/AdminNegocio-Pro-Portable.exe`

---

## Opción 2: Usar el script automático

1. **Descargar el código fuente**
2. **Ejecutar el script**:
   - Doble clic en `build-windows.bat`
   - O abrir PowerShell y ejecutar:
     ```powershell
     .\build-windows.bat
     ```
3. **Esperar** a que termine la construcción
4. **Encontrar el .exe** en la carpeta `release/`

---

## Solución de problemas

### Error: "npm no se reconoce"
- Instala Node.js desde: https://nodejs.org/
- Reinicia tu computadora después de instalar

### Error: "No se puede cargar el archivo..."
- Asegúrate de ejecutar PowerShell como Administrador
- O ejecuta: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

### Error durante la construcción
- Borra la carpeta `node_modules` y vuelve a ejecutar `npm install`
- Asegúrate de tener conexión a internet

---

## Archivos generados

Después de la construcción, encontrarás:

| Archivo | Descripción |
|---------|-------------|
| `release/AdminNegocio Pro Setup 1.0.0.exe` | Instalador con asistente |
| `release/AdminNegocio-Pro-Portable.exe` | Versión portable (sin instalar) |
| `release/win-unpacked/` | Carpeta con archivos sueltos |

---

## Notas importantes

- **Persistencia de datos**: Los datos se guardan en:
  - Windows: `%APPDATA%/adminnegocio-pro/`
  - O en el navegador localStorage cuando se usa la versión web

- **Actualizaciones**: Para actualizar, simplemente construye una nueva versión y reinstala

- **Copia de seguridad**: Usa la función "Exportar Datos" en Configuración para hacer backups
