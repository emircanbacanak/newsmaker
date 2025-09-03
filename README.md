# 🌍 Global News Hub

Dünya çapında 20+ haber kaynağından güncel haberleri toplayan modern web uygulaması.

## 🚀 Render'da Deployment

### 1️⃣ Render Hesabı ve Repo Bağlantısı

1. [render.com](https://render.com) adresinden ücretsiz hesap oluşturun
2. GitHub hesabınızı bağlayın
3. Bu projeyi GitHub'a push edin

### 2️⃣ Web Service Oluşturma

1. Render Dashboard'da **"New +"** → **"Web Service"** seçin
2. GitHub repo'nuzu seçin
3. Aşağıdaki ayarları yapın:

```
Name: global-news-hub
Region: Frankfurt (EU Central) 
Branch: main
Root Directory: backend
Runtime: Node
Build Command: npm install
Start Command: npm start
```

### 3️⃣ Environment Variables (Opsiyonel)

Render'da environment variables ekleyebilirsiniz:
```
NODE_ENV=production
PORT=10000 (Render otomatik ayarlar)
```

### 4️⃣ Deploy Süreci

- İlk deploy 5-10 dakika sürebilir
- Tüm dependencies yüklenecek
- Automatic deploys aktif olur (her git push'ta)

## 📱 Özellikler

- ✅ 20+ uluslararası haber kaynağı
- ✅ Gerçek zamanlı haber akışı (Server-Sent Events)
- ✅ Responsive tasarım (mobil uyumlu)
- ✅ Zaman filtresi (1 saat, 6 saat, 12 saat)
- ✅ Site arama özelliği
- ✅ Modern glassmorphism tasarım
- ✅ Karanlık/Açık tema
- ✅ Otomatik timezone dönüşümü

## 🗞️ Haber Kaynakları

- **ABD:** USA Today
- **Almanya:** Abendblatt
- **İspanya:** El Mundo
- **Brezilya:** Folha de S.Paulo
- **Rusya:** Gazeta.ru
- **Çin:** Global Times
- **Hindistan:** Hindustan Times
- **Japonya:** Japan News
- **Bosna:** Klix.ba
- **Fransa:** Le Figaro
- **Kanada:** National Post
- **Avustralya:** News.com.au
- **Güney Kore:** Naver News
- **İtalya:** La Repubblica
- **Hollanda:** De Telegraaf
- **Afrika:** The Africa Report
- **İngiltere:** The Sun, Standard
- **Endonezya:** Tribun News
- **Meksika:** Animal Político

## 🛠️ Teknik Detaylar

- **Backend:** Node.js + Express
- **Scraping:** Cheerio + Axios
- **Real-time:** Server-Sent Events
- **Timezone:** Moment.js + Moment-timezone
- **Frontend:** Vanilla JavaScript + Modern CSS
- **Deployment:** Render.com ready

## 🔧 Yerel Geliştirme

```bash
cd backend
npm install
npm start
```

http://localhost:3000 adresinden erişilebilir.

## 📊 Performance

- Server-side caching
- Debounced search
- Throttled scroll
- Optimized DOM updates
- Mobile-first responsive design

---

🚀 **Render'da canlı olarak çalışmaya hazır!**