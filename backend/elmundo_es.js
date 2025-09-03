const axios = require("axios");
const cheerio = require("cheerio");
const moment = require("moment-timezone");
const iconv = require("iconv-lite");

let ARTICLES = new Map();

const SCRAPE_INTERVAL =5 * 60 * 1000; // 5 dakika
const EXPIRATION = 12 * 60 * 60 * 1000; // 12 saat
const RETRY_INTERVAL = 30 * 60 * 1000; // 30 dakika
let isFirstRun = true;

function getFullUrl(urlPath) {
  if (urlPath && urlPath.startsWith("/")) {
    return `https://www.elmundo.es${urlPath}`;
  }
  return urlPath;
}

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
        // İspanya saati (Europe/Madrid) Türkiye saatine (Europe/Istanbul) çevir
        dateObj = dateObj.tz("Europe/Istanbul");
        let fullTitle = kicker ? `${kicker}: ${title}` : title;
        newsList.push({
          link: getFullUrl(link),
          resim: imageUrl,
          baslik: fullTitle,
          aciklama: title,
          timestamp: dateObj.format("YYYY-MM-DD HH:mm"),
          source: "elmundo.es"
        });
      }
    });
  } catch (err) {
  }
  return newsList;
}

async function scrapeNews() {
  try {
    const newArticles = await getNews();
    newArticles.forEach(article => {
      if (!ARTICLES.has(article.link)) {
        ARTICLES.set(article.link, article);
      }
    });
    ARTICLES.forEach((article, key) => {
      const artMoment = moment(article.timestamp, "YYYY-MM-DD HH:mm");
      if (moment().diff(artMoment) >= EXPIRATION) {
        ARTICLES.delete(key);
      }
    });
    ARTICLES = new Map([...ARTICLES.entries()].sort((a, b) => 
      moment(b[1].timestamp, "YYYY-MM-DD HH:mm").diff(moment(a[1].timestamp, "YYYY-MM-DD HH:mm"))
    ));

  } catch (err) {
    setTimeout(scrapeNews, RETRY_INTERVAL);
  }
}

function cleanupArticles() {
  ARTICLES.forEach((article, key) => {
    const artMoment = moment(article.timestamp, "YYYY-MM-DD HH:mm");
    if (moment().diff(artMoment) >= EXPIRATION) {
      ARTICLES.delete(key);
    }
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
    scrapeNews();
    cleanupArticles();
  }, SCRAPE_INTERVAL);
}

function getElmundoArticles() {
  return Array.from(ARTICLES.values());
}

module.exports = { startElmundoScraper, getElmundoArticles };
