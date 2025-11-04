@echo off
REM Publish all Pyra packages to npm in the correct order
REM Usage: publish-all.bat

echo 🚀 Publishing Pyra packages to npm...
echo.

REM 1. Publish @pyra/shared
echo 📦 Publishing @pyra/shared...
cd packages\shared
call npm publish
if %errorlevel% neq 0 exit /b %errorlevel%
echo ✅ @pyra/shared published
echo.

REM 2. Publish @pyra/core
echo 📦 Publishing @pyra/core...
cd ..\core
call npm publish
if %errorlevel% neq 0 exit /b %errorlevel%
echo ✅ @pyra/core published
echo.

REM 3. Publish @pyra/cli
echo 📦 Publishing @pyra/cli...
cd ..\cli
call npm publish
if %errorlevel% neq 0 exit /b %errorlevel%
echo ✅ @pyra/cli published
echo.

echo 🎉 All packages published successfully!
echo.
echo Users can now install with:
echo   npm install -D @pyra/cli
echo   npx @pyra/cli create my-app

cd ..\..
