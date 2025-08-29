@echo off
setlocal ENABLEDELAYEDEXPANSION
cd /d %~dp0

REM Backend on http://localhost:5299
start "BvgAuthApi" cmd /k dotnet run --project BvgAuthApi --urls http://localhost:5299

REM Frontend on http://localhost:4200
cd bvg-portal
start "bvg-portal" cmd /k npm start

endlocal
