#!/bin/bash

# Global News Hub - Render Deployment Script
echo "🚀 Global News Hub Deployment Script"
echo "======================================"

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📁 Git repository başlatılıyor..."
    git init
    git branch -M main
fi

# Add all files
echo "📦 Dosyalar git'e ekleniyor..."
git add .

# Commit changes
echo "💾 Commit oluşturuluyor..."
git commit -m "Deploy: Global News Hub - $(date '+%Y-%m-%d %H:%M:%S')"

# Check if remote exists
if ! git remote get-url origin > /dev/null 2>&1; then
    echo "⚠️  Git remote URL'i ayarlanmamış!"
    echo "Lütfen GitHub repo'nuzun URL'ini girin:"
    read -p "GitHub URL: " github_url
    git remote add origin $github_url
fi

# Push to GitHub
echo "🔄 GitHub'a push ediliyor..."
git push -u origin main

echo ""
echo "✅ Deployment hazır!"
echo ""
echo "📋 Render'da yapılacaklar:"
echo "1. render.com → New Web Service"
echo "2. GitHub repo'nuzu seçin"
echo "3. Ayarlar otomatik yüklenecek (render.yaml sayesinde)"
echo "4. Deploy butonuna tıklayın"
echo ""
echo "🌐 Health Check URL: /health"
echo "📊 Canlı site yaklaşık 5-10 dakikada hazır olacak"
echo ""
echo "🎉 İyi çalışmalar!"
