const axios = require("axios");
const cheerio = require("cheerio");
const moment = require("moment-timezone");
const iconv = require("iconv-lite");

let ARTICLES = [];

const SCRAPE_INTERVAL = 5 * 60 * 1000;
const EXPIRATION = 12 * 60 * 60 * 1000; // 12 saat
const RETRY_INTERVAL = 30 * 60 * 1000; // 30 dakika

let isFirstRun = true;

async function getNews() {
    const url = 'https://www.elmundo.es/ultimas-noticias.html';
    let newsList = [];
    try {
        const response = await axios.get(url, { responseType: "arraybuffer" });
        const decodedHtml = iconv.decode(response.data, "iso-8859-1");
        const $ = cheerio.load(decodedHtml);
        const articles = $("article.ue-c-cover-content");

        articles.each((i, el) => {
            const kicker = $(el).find("span.ue-c-cover-content__kicker").text().trim();
            const title = $(el).find("h2.ue-c-cover-content__headline").text().trim();
            const link = $(el).find("a.ue-c-cover-content__link").attr("href") || "";
            let imageUrl = $(el).find("img.ue-c-cover-content__image").attr("src") || "";
            if (!imageUrl) {
                imageUrl = $(el).find("img.ue-c-cover-content__image").attr("data-src") || "";
            }
            let pubDateStr = $(el).find("div.ue-c-cover-content__published-date").attr("data-publish") || "";

            let dateObj = pubDateStr ? moment.tz(pubDateStr, "YYYY-MM-DD HH:mm:ss", "Europe/Madrid") : null;

            if (dateObj) {
                dateObj = dateObj.add(2, 'hours');
                let fullTitle = kicker ? `${kicker}: ${title}` : title;

                newsList.push({
                    link: link.startsWith("/") ? `https://www.elmundo.es${link}` : link,
                    resim: imageUrl,
                    baslik: fullTitle,
                    aciklama: title,
                    timestamp: dateObj.format("YYYY-MM-DD HH:mm"),
                    source: "elmundo.es"
                });
            }
        });
    } catch (err) {
        console.error("Elmundo.es Haberler çekilirken hata oluştu:");
    }
    return newsList;
}

async function scrapeNews() {
    try {
        const newArticles = await getNews();
        newArticles.forEach(article => {
            const existingArticleIndex = ARTICLES.findIndex(existing => existing.link === article.link);
            if (existingArticleIndex !== -1) {
                ARTICLES[existingArticleIndex] = article;
            } else {
                ARTICLES.unshift(article);
            }
        });
        ARTICLES = ARTICLES.filter(art => {
            const artMoment = moment(art.timestamp, "YYYY-MM-DD HH:mm");
            return moment().diff(artMoment) < EXPIRATION;
        });
        ARTICLES.sort((a, b) => moment(b.timestamp, "YYYY-MM-DD HH:mm").diff(moment(a.timestamp, "YYYY-MM-DD HH:mm")));
    } catch (err) {
        console.error("Elmundo.es Haberleri tararken hata oluştu:");
        // İnternet hatası veya sayfa hatası varsa 30 dakika sonra tekrar dene
        setTimeout(scrapeNews, RETRY_INTERVAL);
    }
}

function cleanupArticles() {
    ARTICLES = ARTICLES.filter(art => {
        const artMoment = moment(art.timestamp, "YYYY-MM-DD HH:mm");
        return moment().diff(artMoment) < EXPIRATION;
    });
}

function startElmundoScraper() {
    if (isFirstRun) {
        console.log("Elmundo.es İlk haber çekme işlemi başlatılıyor...");
        isFirstRun = false;
    } else {
        console.log("Elmundo.es Haberler güncelleniyor...");
    }
    scrapeNews();
    setInterval(() => {
        console.log("Elmundo.es Haberler güncelleniyor...");
        scrapeNews();
        cleanupArticles();
    }, SCRAPE_INTERVAL);
}

function getElmundoArticles() {
    return ARTICLES;
}

module.exports = { startElmundoScraper, getElmundoArticles };
