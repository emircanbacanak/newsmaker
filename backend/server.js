const express = require("express");
const path = require("path");

const { startAbendblattScraper, getAbendblattArticles } = require("./abendblatt");
const { startAnimalpoliticoScraper, getAnimalpoliticoArticles } = require("./animalpolitico");
const { startElmundoScraper, getElmundoArticles } = require("./elmundo_es");
const { startFolhaScraper, getFolhaArticles } = require("./folha_uol");
const { startGazetaScraper, getGazetaArticles } = require("./gazeta_ru");
const { startGlobalTimesScraper, getGlobalTimesArticles } = require("./globaltimes");
const { startHindustanTimesScraper, getHindustanTimesArticles } = require("./hindustantimes");
const { startJapanNews, getJapanNewsArticles } = require("./japannews");
const { startKlixNews, getKlixArticles } = require("./klix_ba");
const { startlefigaroNews, getlefigaroArticles } = require("./lefigaro");
const { startNationalPostNews, getNationalPostArticles } = require("./nationalpost");
const { startnews_com, getnews_comArticles } = require("./news_com");
const { startNaverNews, getNaverArticles } = require("./news_naver");
const { startRepubblicaScraper, getRepubblicaArticles } = require("./repubblica");
const { startTelegraafScraper, getTelegraafArticles } = require("./telegraaf");
const { startAfricaReportScraper, getAfricaReportArticles } = require("./theafricareport");
const { startTheSunScraper, getTheSunArticles } = require("./thesun");
const { startTribunnewsScraper, getTribunnewsArticles } = require("./tribunnews");
const { startUSATodayScraper, getUSATodayArticles } = require("./usatoday");
const { startStandardScraper, getStandardArticles } = require("./standard");

const app = express();
const port = process.env.PORT || 3000;

// Hafıza sistemi - haberleri server'da tut
let cachedArticles = [];
let lastUpdateTime = 0;

app.use(express.static(__dirname));

// Haberleri toplama fonksiyonu
function getAllArticles() {
    let allArticles = [
        ...getUSATodayArticles(),
        ...getAbendblattArticles(),
        ...getAnimalpoliticoArticles(),
        ...getElmundoArticles(),
        ...getFolhaArticles(),
        ...getGazetaArticles(),
        ...getGlobalTimesArticles(),
        ...getHindustanTimesArticles(),
        ...getJapanNewsArticles(),
        ...getKlixArticles(),
        ...getlefigaroArticles(),
        ...getNationalPostArticles(),
        ...getnews_comArticles(),
        ...getNaverArticles(),
        ...getRepubblicaArticles(),
        ...getTelegraafArticles(),
        ...getAfricaReportArticles(),
        ...getTheSunArticles(),
        ...getTribunnewsArticles(),
        ...getStandardArticles(),
       
    ];

    // Filter out articles with null/undefined timestamps and sort
    allArticles = allArticles.filter(article => article && article.timestamp);
    allArticles.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return allArticles;
}

// İlk haberleri yükle
setTimeout(() => {
    cachedArticles = getAllArticles();
    lastUpdateTime = Date.now();
    console.log(`İlk ${cachedArticles.length} haber hafızaya yüklendi`);
}, 10000); // 10 saniye sonra ilk yükleme

app.get("/stream", (req, res) => {
    console.log('Yeni EventSource bağlantısı kuruldu');
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // İlk bağlantıda hafızadaki haberleri hemen gönder
    if (cachedArticles.length > 0) {
        let data = JSON.stringify(cachedArticles);
        console.log(`İlk bağlantıda ${cachedArticles.length} haber gönderiliyor`);
        res.write(`data: ${data}\n\n`);
    } else {
        console.log('Hafızada henüz haber yok, bekleniyor...');
    }

    let lastData = "";
    const intervalId = setInterval(() => {
        // Hafızayı güncelle
        const newArticles = getAllArticles();
        if (newArticles.length > 0) {
            cachedArticles = newArticles;
            lastUpdateTime = Date.now();
        }

        let data = JSON.stringify(cachedArticles);

        if (data !== lastData) {
            res.write(`data: ${data}\n\n`);
            lastData = data;
        }
        // Heartbeat mesajını azalt (sadece 30 saniyede bir)
        if (Math.random() < 0.1) { // %10 ihtimalle gönder
            res.write(`:\n\n`);
        }
    }, 10000); // 10 saniyeye çıkarıldı 

    req.on("close", () => {
        clearInterval(intervalId);
        res.end();
    });
});


// Health check endpoint for Render
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "OK",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        cached_articles: cachedArticles.length,
        memory: process.memoryUsage(),
        version: "1.0.0"
    });
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, () => {
    console.log(`Server ${port} portunda çalışıyor...`);

    const scrapers = [
        startUSATodayScraper,
        startAbendblattScraper,
        startAnimalpoliticoScraper,
        startElmundoScraper,
        startFolhaScraper,
        startGazetaScraper,
        startGlobalTimesScraper,
        startHindustanTimesScraper,
        startJapanNews,
        startKlixNews,
        startlefigaroNews,
        startNationalPostNews,
        startnews_com,
        startNaverNews,
        startRepubblicaScraper,
        startTelegraafScraper,
        startAfricaReportScraper,
        startTheSunScraper,
        startTribunnewsScraper,
        startStandardScraper,
        
    ];

    scrapers.forEach((scraper, index) => {
        setTimeout(() => {
            console.log(`Başlatılıyor: ${scraper.name}`);
            scraper();
        }, index *5000); 
    });
});
