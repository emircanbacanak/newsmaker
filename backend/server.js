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

app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let lastData = "";
    const intervalId = setInterval(() => {
        let allArticles = [
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
            ...getUSATodayArticles(),
        ];

        allArticles.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        let data = JSON.stringify(allArticles);

        if (data !== lastData) {
            res.write(`data: ${data}\n\n`);
            lastData = data;
        }
        res.write(`:\n\n`);
    }, 5000); 

    req.on("close", () => {
        clearInterval(intervalId);
        res.end();
    });
});


app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

app.listen(port, () => {
    console.log(`Server ${port} portunda çalışıyor...`);

    const scrapers = [
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
        startUSATodayScraper
    ];

    scrapers.forEach((scraper, index) => {
        setTimeout(() => {
            console.log(`Başlatılıyor: ${scraper.name}`);
            scraper();
        }, index *5000); 
    });
});
