@echo off
title KTX DUE - Tao Link Chia Se Cho Moi Nguoi Truy Cap (MIS3047)
color 2F

echo ==============================================================================
echo   HE THONG KTX DUE (MIS3047) - TAO LINK CHIA SE TRUY CAP CONG KHAI
echo ==============================================================================
echo.

cd /d "%~dp0"
set PATH=C:\Program Files\nodejs;%PATH%

echo [*] Dang kiem tra dia chi IP xac thuc...
for /f "delims=" %%a in ('powershell -Command "(Invoke-RestMethod -Uri https://loca.lt/mytunnelpassword).Trim()"') do set MY_IP=%%a

echo.
echo ==============================================================================
echo   MA XAC THUC TUNNEL PASSWORD LA: %MY_IP%
echo   (Nguoi xem chi can nhap so %MY_IP% roi bam "Click to Submit" la vao duoc!)
echo ==============================================================================
echo.
echo [*] Dang tao duong link HTTPS cong khai de gui cho ban be, thay co...
echo.

npx localtunnel --port 3000

pause
