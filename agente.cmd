@echo off
rem ============================================================
rem  Atalho para rodar o Agente de IA do SGP sem abrir o VS Code.
rem  Basta dar dois cliques neste arquivo (ou num atalho dele).
rem ============================================================
chcp 65001 >nul
cd /d "%~dp0"
title Agente de IA - SGP

:menu
cls
echo ============================================
echo            AGENTE DE IA DO SGP
echo ============================================
echo.
echo   [1] Testar sem alterar nada (dry-run)
echo   [2] Rodar de verdade (commit + push + PR)
echo   [3] 100%% local - Ollama faz tudo (dry-run)
echo   [0] Sair
echo.
set "opt="
set /p opt="Escolha uma opcao e tecle Enter: "

if "%opt%"=="1" ( call npm run agent -- --dry-run & goto fim )
if "%opt%"=="2" ( call npm run agent & goto fim )
if "%opt%"=="3" ( set "AGENT_CODER=ollama" & call npm run agent -- --dry-run & goto fim )
if "%opt%"=="0" ( exit /b )

echo.
echo Opcao invalida. Tente de novo.
timeout /t 2 >nul
goto menu

:fim
echo.
echo ============================================
echo  Agente finalizado. Pode fechar esta janela.
echo ============================================
pause
