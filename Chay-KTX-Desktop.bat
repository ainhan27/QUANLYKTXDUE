@echo off
title KTX DUE - He Thong Quan Ly Tuyen Sinh Noi Tru Desktop (MIS3047)
color 1F

echo ==============================================================================
echo   HE THONG XET DUYET NOI TRU KTX - DAI HOC KINH TE DA NANG (MIS3047)
echo   DONG GOI DESKTOP APP (ELECTRON) - KHOI DONG TRUC TIEP
echo ==============================================================================
echo.

cd /d "%~dp0"
set PATH=C:\Program Files\nodejs;%PATH%

echo [*] Dang khoi dong ung dung Desktop KTX DUE...
echo [*] Ung dung se tu dong quan ly may chu noi bo va co so du lieu.
echo.
npm run desktop
