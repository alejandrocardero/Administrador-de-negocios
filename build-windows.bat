@echo off
chcp 65001 >nul
title Construyendo AdminNegocio Pro...
echo ==========================================
echo  CONSTRUYENDO ADMINNEGOcio PRO PARA WINDOWS
echo ==========================================
echo.

:: Verificar si Node.js está instalado
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js no está instalado.
    echo Por favor, instala Node.js desde: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js detectado:
node --version
echo.

:: Verificar si npm está disponible
npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm no está disponible.
    echo.
    pause
    exit /b 1
)

echo [OK] npm detectado:
npm --version
echo.

:: Instalar dependencias
echo [1/4] Instalando dependencias...
npm install
if errorlevel 1 (
    echo [ERROR] Falló la instalación de dependencias.
    echo.
    pause
    exit /b 1
)
echo [OK] Dependencias instaladas.
echo.

:: Construir la aplicación React
echo [2/4] Construyendo aplicación...
npm run build
if errorlevel 1 (
    echo [ERROR] Falló la construcción de la aplicación.
    echo.
    pause
    exit /b 1
)
echo [OK] Aplicación construida.
echo.

:: Crear el ejecutable
echo [3/4] Creando ejecutable Windows...
npm run dist
if errorlevel 1 (
    echo [ERROR] Falló la creación del ejecutable.
    echo.
    pause
    exit /b 1
)
echo [OK] Ejecutable creado.
echo.

:: Mostrar resultado
echo ==========================================
echo  CONSTRUCCION COMPLETADA EXITOSAMENTE
echo ==========================================
echo.
echo Archivos generados en la carpeta "release\":
echo.

if exist "release\AdminNegocio Pro Setup 1.0.0.exe" (
    echo   - Instalador: AdminNegocio Pro Setup 1.0.0.exe
)

if exist "release\AdminNegocio-Pro-Portable.exe" (
    echo   - Portable: AdminNegocio-Pro-Portable.exe
)

echo.
echo Para instalar, ejecuta "AdminNegocio Pro Setup 1.0.0.exe"
echo.
pause
