@echo off
setlocal

echo Building vscode-multi-model extension...

where npm >nul 2>nul
if %errorlevel% neq 0 (
  echo Error: npm is not installed
  exit /b 1
)

call npm install
if %errorlevel% neq 0 exit /b 1

call npm run compile
if %errorlevel% neq 0 exit /b 1

call npm test
if %errorlevel% neq 0 exit /b 1

where vsce >nul 2>nul
if %errorlevel% neq 0 (
  echo Installing @vscode/vsce...
  call npm install -g @vscode/vsce
)

call vsce package
if %errorlevel% neq 0 exit /b 1

for /f "delims=" %%f in ('dir /b /o-d *.vsix 2^>nul') do (
  echo.
  echo Build successful: %%f
  echo.
  echo Install with:
  echo   code --install-extension %%f
  goto :done
)

echo Error: .vsix file not found
exit /b 1

:done
endlocal
