const axios = require("axios");
const cheerio = require("cheerio");
const moment = require("moment-timezone");

let ARTICLES = new Set(); 
const BASE_URL = "https://www.news.com.au/national/breaking-news";

const SCRAPE_INTERVAL = 5 * 60 * 1000; // 5 dakika
const RETRY_INTERVAL = 30 * 60 * 1000; // 30 dakika bekleme süresi
const EXPIRATION = 12 * 60 * 60 * 1000; // 12 saat
let isFirstRun = true;

const headers = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
};

const getArticleTimestamp = async (link, attempt = 1) => {
  try {
    const response = await axios.get(link, { headers });
    const $ = cheerio.load(response.data);
    let dateText = $("#publish-date.byline_publish").text().trim();
    if (dateText) {
      let dateMoment = moment.tz(dateText, "MMMM DD, YYYY - hh:mmA", "Australia/Sydney");
      dateMoment = dateMoment.tz("Europe/Istanbul");
      return dateMoment;
    }
  } catch (error) {
    if (error.response && error.response.status === 502 && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL));
      return getArticleTimestamp(link, attempt + 1);
    }
    return null;
  }
};

const getNews = async () => {
  try {
    const response = await axios.get(BASE_URL, { headers });
    const $ = cheerio.load(response.data);
    let newsList = [];
    const articles = $("article.storyblock").toArray();
    const articlePromises = articles.map(async (article) => {
      let imgTag = $(article).find("img");
      if (imgTag.length) {
        let link = $(article).find("a.storyblock_title_link").attr("href");
        let imgSrc = imgTag.attr("src");
        let title = $(article).find("h4.storyblock_title").text().trim();
        let description = $(article).find("p.storyblock_standfirst").text().trim();
        let dtTurkey = await getArticleTimestamp(link);
        if (dtTurkey) {
          const twelveHoursAgo = moment().subtract(EXPIRATION, "hours");
          if (dtTurkey.isSameOrAfter(twelveHoursAgo)) {
            const articleData = {
              link,
              resim: imgSrc,
              baslik: title,
              aciklama: description,
              timestamp: dtTurkey,
              source: "news.com.au",
            };
            return articleData;
          }
        }
      }
      return null;
    });
    const results = await Promise.all(articlePromises);
    newsList = results.filter((article) => article !== null);
    return newsList;
  } catch (error) {
    console.error("news.com.au Haber çekme hatası:");

    if (error.response && error.response.status === 403) {
      console.log("news.com 403 hatası alındı, 30 dakika sonra tekrar deneniyor...");
      setTimeout(scrapeNews, RETRY_INTERVAL);
      return [];
    }

    if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND" || error.code === "ETIMEDOUT") {
      console.log("news.com Bağlantı hatası, 30 dakika sonra tekrar deneniyor...");
      setTimeout(scrapeNews, RETRY_INTERVAL);
      return [];
    }
    return [];
  }
};

const scrapeNews = async () => {
  const newArticles = await getNews();
  const now = moment();
  let isDataUpdated = false;
  newArticles.forEach((article) => {
    const existing = [...ARTICLES].find((existing) => existing.link === article.link);
    if (!existing) {
      ARTICLES.add(article);
      isDataUpdated = true;
    }
  });

  ARTICLES = new Set([...ARTICLES].filter((article) => now.diff(moment(article.timestamp), "hours") <= EXPIRATION));
  if (isDataUpdated) {
    sendDataToClients();
  }
  setTimeout(scrapeNews, SCRAPE_INTERVAL);
};

const sendDataToClients = () => {
  const sortedArticles = [...ARTICLES];
  return sortedArticles.map((art) => ({
    baslik: art.baslik,
    aciklama: art.aciklama,
    link: art.link,
    resim: art.resim,
    timestamp: moment(art.timestamp).isValid() ? moment(art.timestamp).format("YYYY-MM-DD HH:mm") : "Geçersiz Tarih",
    source: art.source,
  }));
};

const startnews_com = async () => {
  if (isFirstRun) {
    console.log("news.com İlk haber çekme işlemi başlatılıyor...");
    isFirstRun = false;
  } else {
    console.log("news.com Haberler güncelleniyor...");
  }
  await scrapeNews();
};
const getnews_comArticles = () => sendDataToClients();
module.exports = { startnews_com, getnews_comArticles };
