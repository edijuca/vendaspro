@echo off
setlocal

set "PROJECT=%~dp0"
set "NODE_DIR=C:\Users\Usuario\AppData\Local\hermes\node"
set "NODE=%NODE_DIR%\node.exe"
set "TSX=%PROJECT%node_modules\tsx\dist\cli.mjs"
set "VITEJS=%PROJECT%node_modules\vite\bin\vite.js"
set "PATH=%NODE_DIR%;%PATH%"

cd /d "%PROJECT%"

rem JWT_SECRET fora do codigo (gerada uma vez e persistida em arquivo local)
set "SECRET_FILE=%PROJECT%.jwt_secret"
if not exist "%SECRET_FILE%" (
  powershell -NoProfile -Command "$s=[guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N'); [IO.File]::WriteAllText('%SECRET_FILE%', $s)"
)
set /p JWT_SECRET=<"%SECRET_FILE%"
if not defined JWT_SECRET (
  echo [ERRO] Falha ao ler/gerar JWT_SECRET em %SECRET_FILE%
  pause
  exit /b 1
)

echo ========================================
echo  VendasPRO - Iniciando Ambiente
echo ========================================
echo.

if not exist "%NODE%" (
  echo [ERRO] Node.exe nao encontrado: %NODE%
  pause
  exit /b 1
)
if not exist "%TSX%" (
  echo [ERRO] Dependencias ausentes: %TSX%
  echo        Rode: npm install
  pause
  exit /b 1
)
if not exist "%VITEJS%" (
  echo [ERRO] Dependencias ausentes: %VITEJS%
  echo        Rode: npm install
  pause
  exit /b 1
)

powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }"
if errorlevel 1 (
  echo [ERRO] Porta 3001 ja esta em uso.
  echo        Verifique com: netstat -ano ^| findstr :3001
  pause
  exit /b 1
)

powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }"
if errorlevel 1 (
  echo [ERRO] Porta 5173 ja esta em uso.
  echo        Verifique com: netstat -ano ^| findstr :5173
  pause
  exit /b 1
)

echo [1/2] Iniciando Backend (porta 3001)...
echo.
start "VendasPRO-Backend" cmd /k ""%NODE%" "%TSX%" watch server\index.ts"
timeout /t 3 /nobreak >nul

echo [2/2] Iniciando Frontend (porta 5173)...
echo.
start "VendasPRO-Frontend" cmd /k ""%NODE%" "%VITEJS%" --port=5173 --host=0.0.0.0"

echo.
echo ========================================
echo  Ambiente iniciado!
echo  Backend:  http://localhost:3001
echo  Frontend: http://localhost:5173
echo ========================================
echo.
echo Para parar: Feche as janelas ou taskkill /F /IM node.exe
echo.

endlocal
