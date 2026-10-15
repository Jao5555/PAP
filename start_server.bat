@echo off
title Void Defense - Servidor Local
color 0A
echo ================================================
echo   VOID DEFENSE - A iniciar servidor...
echo ================================================
echo.
echo Nao feches esta janela enquanto jogas!
echo Para parar o servidor, fecha esta janela.
echo.

REM Descobre qual comando Python existe neste PC
set PYCMD=
where python >nul 2>nul
if %ERRORLEVEL% == 0 set PYCMD=python
if "%PYCMD%"=="" (
    where python3 >nul 2>nul
    if %ERRORLEVEL% == 0 set PYCMD=python3
)

if "%PYCMD%"=="" goto nopython

REM -- Tenta o servidor multiplayer (precisa do pacote aiohttp) --
echo A verificar dependencias multiplayer...
%PYCMD% -c "import aiohttp" >nul 2>nul
if %ERRORLEVEL% == 0 goto runmp

echo A instalar aiohttp (so na primeira vez, precisa de internet)...
%PYCMD% -m pip install aiohttp --quiet
%PYCMD% -c "import aiohttp" >nul 2>nul
if %ERRORLEVEL% == 0 goto runmp

REM -- aiohttp nao disponivel: cai para o servidor simples (sem multiplayer) --
echo.
echo [AVISO] Nao foi possivel instalar aiohttp (sem internet?).
echo A iniciar em modo OFFLINE - o jogo funciona, mas sem
echo multijogador nem leaderboard partilhado.
echo.
start http://localhost:8000/login.html
%PYCMD% -m http.server 8000
goto end

:runmp
echo Servidor multiplayer pronto.
echo.
start http://localhost:8000/login.html
%PYCMD% server\server.py
goto end

:nopython
echo.
echo [ERRO] Python nao foi encontrado no teu PC.
echo.
echo SOLUCAO RAPIDA: instala o Python em python.org
echo   (marca a opcao "Add Python to PATH" durante a instalacao)
echo.
echo ALTERNATIVA: usa a extensao "Live Server" no VS Code
echo   1. Abre esta pasta no VS Code
echo   2. Clica com botao direito em login.html
echo   3. Escolhe "Open with Live Server"
echo   (nota: sem Python nao ha multijogador nem leaderboard)
echo.
pause

:end
