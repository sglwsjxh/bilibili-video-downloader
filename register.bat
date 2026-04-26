@echo off
set "SCRIPT_DIR=%~dp0"
set "REG_FILE=%TEMP%\ffmpeg-run.reg"

(
  echo Windows Registry Editor Version 5.00
  echo.
  echo [HKEY_CLASSES_ROOT\ffmpeg-run]
  echo @="URL:ffmpeg-run Protocol"
  echo "URL Protocol"=""
  echo.
  echo [HKEY_CLASSES_ROOT\ffmpeg-run\shell\open\command]
  echo @="wscript.exe \"%SCRIPT_DIR%run-ffmpeg.vbs\" \"%%1\""
) > "%REG_FILE%"

regedit /s "%REG_FILE%"
del "%REG_FILE%"