@echo off
echo 🚀 Global News Hub Deployment Script
echo ======================================

REM Check if git is initialized
if not exist ".git" (
    echo 📁 Git repository başlatılıyor...
    git init
    git branch -M main
)

REM Add all files
echo 📦 Dosyalar git'e ekleniyor...
git add .

REM Commit changes
echo 💾 Commit oluşturuluyor...
git commit -m "Deploy: Global News Hub - %date% %time%"

REM Check if remote exists
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Git remote URL'i ayarlanmamış!
    set /p github_url="GitHub URL'inizi girin: "
    git remote add origin %github_url%
)

REM Push to GitHub
echo 🔄 GitHub'a push ediliyor...
git push -u origin main

echo.
echo ✅ Deployment hazır!
echo.
echo 📋 Render'da yapılacaklar:
echo 1. render.com → New Web Service
echo 2. GitHub repo'nuzu seçin
echo 3. Ayarlar otomatik yüklenecek (render.yaml sayesinde)
echo 4. Deploy butonuna tıklayın
echo.
echo 🌐 Health Check URL: /health
echo 📊 Canlı site yaklaşık 5-10 dakikada hazır olacak
echo.
echo 🎉 İyi çalışmalar!
pause
