const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const moment = require('moment-timezone');
const path = require('path');
const app = express();
let ARTICLES = [];

const SCRAPE_INTERVAL = 1 * 60 * 1000;
const EXPIRATION = 12 * 60 * 60 * 1000;
const BASE_URL = "https://www.usatoday.com";
const NEWS_URL = "https://www.usatoday.com/news/nation/";

function convertEtToTurkey(dateStr) {
    try {
        dateStr = dateStr.replace("ET", "")
                         .replace(/\./g, "")
                         .replace(/,/g, "")
                         .trim()
                         .toUpperCase();
        let currentYear = moment().year();
        if (!/\d{4}$/.test(dateStr)) {
            dateStr = `${dateStr} ${currentYear}`;
        }
        let dtEastern = moment.tz(dateStr, "h:mm A MMM D YYYY", "America/New_York");
        return dtEastern.tz("Europe/Istanbul");
    } catch (err) {
        console.log(`Geçersiz tarih formatı: ${dateStr}`);
        return null;
    }
}

function getFullImageUrl(imagePath) {
    if (!imagePath) {
        return '';
    }
    if (imagePath.startsWith('/')) {
        return BASE_URL + imagePath;
    }
    return imagePath;
}

function getImageUrlToJPG(imagePath) {
    if (!imagePath) return ''; 
    const jpgIndex = imagePath.indexOf('.jpg');
    return jpgIndex !== -1 ? imagePath.substring(0, jpgIndex + 4) : imagePath;
}

async function getNews() {
    let newsList = [];
    try {
        const response = await axios.get(NEWS_URL);
        const $ = cheerio.load(response.data);
        const now = moment().tz("Europe/Istanbul");
        const twelveHoursAgo = now.clone().subtract(12, 'hours');

        $('div.gnt_m_ht a.gnt_m_he, div.gnt_m_ht a.gnt_m_tl').each((i, item) => {
            const link = BASE_URL + $(item).attr('href');
            const imgSrc = BASE_URL + $(item).find('img').attr('src');
            const title = $(item).text().trim();
            const dateInfo = $(item).find('div.gnt_ar_dt').attr('aria-label');
            let timeStr = "";
            if (dateInfo && dateInfo.includes("Updated:")) {
                const match = dateInfo.match(/Updated:\s*([^P]+)/);
                if (match && match[1]) {
                    timeStr = match[1].trim();
                }
            }
            if (!timeStr) {
                const dateElem = $(item).find('div[data-c-dt]');
                timeStr = dateElem.attr('data-c-dt') || "";
            }

            let dtTurkey = timeStr ? convertEtToTurkey(timeStr) : moment().tz("Europe/Istanbul");
            if (dtTurkey && dtTurkey.isAfter(twelveHoursAgo)) {
                newsList.push({
                    link,
                    resim: imgSrc,
                    baslik: title,
                    aciklama: "",
                    timestamp: dtTurkey.format("YYYY-MM-DD HH:mm"),
                    originalTimestamp: dtTurkey,
                    source: "usatoday.com"
                });
            }
        });

        $('a.gnt_m_flm_a').each((i, item) => {
            const link = BASE_URL + $(item).attr('href');
            const imgSrc = getFullImageUrl(
                $(item).find('img').attr('src') || $(item).find('img').attr('data-gl-src')
            );
            const imgSrcToJPG = getImageUrlToJPG(imgSrc);
            const title = $(item).text().trim();
            const description = $(item).attr('data-c-br') || '';
            const dateInfo = $(item).find('div.gnt_ar_dt').attr('aria-label');
            let timeStr = "";
            if (dateInfo && dateInfo.includes("Updated:")) {
                const match = dateInfo.match(/Updated:\s*([^P]+)/);
                if (match && match[1]) {
                    timeStr = match[1].trim();
                }
            }
            if (!timeStr) {
                const pubDateStr = $(item).find('div[data-c-dt]').attr('data-c-dt');
                timeStr = pubDateStr || "";
            }
            const dtTurkey = timeStr ? convertEtToTurkey(timeStr) : moment().tz("Europe/Istanbul");
            const timestamp = dtTurkey ? dtTurkey.format("YYYY-MM-DD HH:mm") : "Tarih bulunamadı";

            if (title) {
                newsList.push({
                    link,
                    resim: imgSrcToJPG,
                    baslik: title,
                    aciklama: description,
                    timestamp,
                    originalTimestamp: dtTurkey,
                    source: "usatoday.com"
                });
            }
        });

    } catch (err) {
        console.error('Haber çekme hatası:', err.message);
    }
    return newsList;
}

async function scrapeNews() {
    try {
        const newArticles = await getNews();
        const now = moment().tz("Europe/Istanbul");
        newArticles.forEach(article => {
            const existingArticleIndex = ARTICLES.findIndex(existing => existing.link === article.link);
            if (existingArticleIndex !== -1) {
                ARTICLES[existingArticleIndex] = article;
            } else {
                ARTICLES.unshift(article);
            }
        });
        ARTICLES = ARTICLES.filter(art => now.diff(moment(art.originalTimestamp)) < EXPIRATION);
        ARTICLES.sort((a, b) => moment(b.originalTimestamp).diff(moment(a.originalTimestamp)));
    } catch (err) {
        console.error('Haber tarama hatası:', err.message);
    }
}

function cleanupArticles() {
    const now = moment().tz("Europe/Istanbul");
    ARTICLES = ARTICLES.filter(art => now.diff(moment(art.originalTimestamp)) < EXPIRATION);
}

function backgroundTask() {
    console.log('İlk haber çekme işlemi başlatılıyor...');
    scrapeNews();
    setInterval(() => {
        console.log('Haberler güncelleniyor...');
        scrapeNews();
        cleanupArticles();
    }, SCRAPE_INTERVAL);
}

app.use(express.static(path.join(__dirname, '../frontend')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    let lastData = '';
    const intervalId = setInterval(() => {
        cleanupArticles();
        let sortedArticles = [...ARTICLES];
        let data = JSON.stringify(sortedArticles.map(art => ({
            baslik: art.baslik,
            aciklama: art.aciklama,
            link: art.link,
            resim: art.resim,
            timestamp: art.timestamp,
            source: art.source
        })));

        if (data !== lastData) {
            res.write(`data: ${data}\n\n`);
            lastData = data;
        }
    }, 1000);

    req.on('close', () => {
        clearInterval(intervalId);
        res.end();
    });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server ${port} portunda çalışıyor...`);
    backgroundTask();
});