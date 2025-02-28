const axios = require("axios");
const cheerio = require("cheerio");
const moment = require("moment-timezone");

let ARTICLES = new Set(); 
const SCRAPE_INTERVAL = 5 * 60 * 1000; // 5 dakika
const EXPIRATION = 12 * 60 * 60 * 1000; // 12 saat
const BASE_URL = "https://www.usatoday.com";
const NEWS_URL = "https://www.usatoday.com/news/nation/";
const TZ = "Europe/Istanbul";

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
        return dtEastern.tz(TZ);
    } catch (err) {
        return null;
    }
}

function getFullImageUrl(imagePath) {
    if (!imagePath) return '';
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
        const now = moment().tz(TZ);
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
            let dtTurkey = timeStr ? convertEtToTurkey(timeStr) : moment().tz(TZ);
            if (dtTurkey && dtTurkey.isAfter(twelveHoursAgo)) {
                const article = {
                    link,
                    resim: imgSrc,
                    baslik: title,
                    aciklama: "",
                    timestamp: dtTurkey.format("YYYY-MM-DD HH:mm"),
                    originalTimestamp: dtTurkey,
                    source: "usatoday.com"
                };
                ARTICLES.add(JSON.stringify(article));  
                newsList.push(article);
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
            const dtTurkey = timeStr ? convertEtToTurkey(timeStr) : moment().tz(TZ);
            const timestamp = dtTurkey ? dtTurkey.format("YYYY-MM-DD HH:mm") : "Tarih bulunamadı";
            if (title) {
                const article = {
                    link,
                    resim: imgSrcToJPG,
                    baslik: title,
                    aciklama: description,
                    timestamp,
                    originalTimestamp: dtTurkey,
                    source: "usatoday.com"
                };
                ARTICLES.add(JSON.stringify(article));
                newsList.push(article); 
            }
        });
    } catch (err) {
    }
    return newsList;
}

async function scrapeNews() {
    try {
        const newArticles = await getNews();
        const now = moment().tz(TZ);
        ARTICLES = new Set([...ARTICLES].filter(articleStr => {
            const article = JSON.parse(articleStr);
            return now.diff(moment(article.originalTimestamp)) < EXPIRATION;
        }));
        ARTICLES = new Set([...ARTICLES].sort((a, b) => {
            const articleA = JSON.parse(a);
            const articleB = JSON.parse(b);
            return moment(articleB.originalTimestamp).diff(moment(articleA.originalTimestamp));
        }));
    } catch (err) {
    }
}

function cleanupArticles() {
    const now = moment().tz(TZ);
    ARTICLES = new Set([...ARTICLES].filter(articleStr => {
        const article = JSON.parse(articleStr);
        return now.diff(moment(article.originalTimestamp)) < EXPIRATION;
    }));
}

function backgroundTask() {
    console.log('usatoday İlk haber çekme işlemi başlatılıyor...');
    scrapeNews();
    setInterval(() => {
        console.log('usatoday Haberler güncelleniyor...');
        scrapeNews();
        cleanupArticles();
    }, SCRAPE_INTERVAL);
}

function getUSATodayArticles() {
    return [...ARTICLES].map(articleStr => {
        const article = JSON.parse(articleStr);
        return {
            baslik: article.baslik,
            aciklama: article.aciklama,
            link: article.link,
            resim: article.resim,
            timestamp: article.timestamp,
            source: article.source
        };
    });
}

function startUSATodayScraper() {
    backgroundTask();
}

module.exports = {
    startUSATodayScraper,
    getUSATodayArticles
};
