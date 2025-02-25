const axios = require("axios");
const cheerio = require("cheerio");
const moment = require("moment-timezone");

const SCRAPE_INTERVAL = 5 * 60 * 1000; // 5 dakika
const RETRY_INTERVAL = 30 * 60 * 1000; // 30 dakika
const EXPIRATION = 12 * 60 * 60 * 1000; // 12 saat
const TZ_ITALY = "Europe/Rome";
const TZ_TURKEY = "Europe/Istanbul";

let ARTICLES = new Set(); 
let firstRun = true;

const getArticleTime = async (articleUrl) => {
  try {
    const response = await axios.get(articleUrl);
    if (response.status === 404) {
      console.log(`repubblica Makale bulunamadı (404): ${articleUrl}`);
      return null;
    }
    const $ = cheerio.load(response.data);
    const timeTag = $("time.story__date");
    if (timeTag.length > 0) {
      const dateTimeStr = timeTag.attr("datetime");
      if (dateTimeStr) {
        return moment(dateTimeStr).tz(TZ_ITALY).tz(TZ_TURKEY).format("YYYY-MM-DD HH:mm");
      }
    }
    return null;
  } catch (error) {
    return null;
  }
};

const getNews = async () => {
  const url = "https://www.repubblica.it/";
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    let newsItems = [];

    $("section.block__layout-A-8.is-hard-news .block__grid .block__item, div.block__grid .block__item")
      .each((index, element) => {
        const newsElem = $(element);
        let newsData = {};
        const titleTag = newsElem.find("h2.entry__title a");
        newsData.title = titleTag.text().trim() || "Başlık yok";
        newsData.link = titleTag.attr("href") || "";
        if (!newsData.link.startsWith("https://")) {
          newsData.link = `https://www.repubblica.it${newsData.link}`;
        }
        if (newsData.link.includes("?ref")) {
          return;
        }
        const imgTag = newsElem.find("figure.entry__media img");
        newsData.img = imgTag.attr("src") || "";
        if (!newsData.img) {
          return;
        }
        const authorTag = newsElem.find("span.entry__author");
        newsData.author = authorTag.text().trim() || "Yazar bilgisi yok";
        newsItems.push(newsData);
      });

    const newsItemsWithTime = await Promise.all(
      newsItems.map(async (newsData) => {
        const articleTime = await getArticleTime(newsData.link);
        if (articleTime) {
          newsData.timestamp = articleTime;
          return newsData;
        } else {
          return null;
        }
      })
    );

    return newsItemsWithTime.filter(item => item !== null);
  } catch (error) {
    console.log("repubblica sayfa erişim hatası, 30 dakika sonra tekrar denenecek...");
    setTimeout(startRepubblicaScraper, RETRY_INTERVAL);
    return [];
  }
};

const verifyArticles = async () => {
  const validArticles = [];
  for (const article of ARTICLES) {
    try {
      await axios.get(article.link, { timeout: 15000 });
      validArticles.push(article);
    } catch (err) {    }
  }
  ARTICLES = new Set(validArticles);
};

const startRepubblicaScraper = async () => {
  if (firstRun) {
    console.log("Repubblica İlk haber çekme işlemi başlatılıyor...");
  }

  try {
    const newArticles = await getNews();
    newArticles.forEach(article => {
      if (![...ARTICLES].some(existing => existing.title === article.title)) {
        ARTICLES.add(article);
      }
    });
    const twelveHoursAgo = moment().subtract(EXPIRATION, 'milliseconds');
    ARTICLES = new Set([...ARTICLES].filter(article => moment(article.timestamp, "YYYY-MM-DD HH:mm").isAfter(twelveHoursAgo)));
    await verifyArticles();
  } catch (error) {
    console.log("Repubblica hata durumu, 30 dakika sonra tekrar denenecek...");
    return setTimeout(startRepubblicaScraper, RETRY_INTERVAL);
  }

  firstRun = false;
  console.log("Repubblica Haberler güncelleniyor...");
  setTimeout(startRepubblicaScraper, SCRAPE_INTERVAL); 
};

const getRepubblicaArticles = () => {
  return [...ARTICLES].map(art => ({
    baslik: art.title,
    aciklama: art.description || '',
    link: art.link,
    resim: art.img,
    timestamp: art.timestamp,
    source: "repubblica.it"
  }));
};

module.exports = { startRepubblicaScraper, getRepubblicaArticles };
