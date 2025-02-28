const axios = require("axios");
const cheerio = require("cheerio");
const moment = require("moment-timezone");

let ARTICLES = [];
let seenLinks = new Set();
let firstRun = false;

const url = "https://www.klix.ba/najnovije";
const turkeyTz = "Europe/Istanbul";

const SCRAPE_INTERVAL = 5 * 60 * 1000;  // 5 dakika
const EXPIRATION = 12 * 60 * 60 * 1000;  // 12 saat
const RETRY_INTERVAL = 30 * 60 * 1000;   // 30 dakika

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
};

async function getLatestNews(url) {
  let newsList = [];
  let pageNumber = 0;
  while (true) {
    const pageUrl = `${url}?str=${pageNumber}`;
    try {
      const response = await axios.get(pageUrl, { headers });
      if (response.status !== 200) {
        console.log(`klix.ba Sayfa ${pageNumber} alınamadı`);
        break;
      }

      const $ = cheerio.load(response.data);
      const articles = $(".relative.overflow-hidden.h-full.flex.space-x-2.md\\:space-x-3.space-y-0.md\\:space-y-1");
      if (articles.length === 0) {
        break;
      }

      let foundOldArticle = false;
      articles.each((i, el) => {
        const title = $(el).find("h2").text().trim();
        const link = "https://www.klix.ba" + $(el).find("a[href]").attr("href");
        const description = $(el).find("p.hidden.md\\:block.text-base.mt-2.text-gray-500.truncate").text().trim() || "Açıklama yok";
        const image = $(el).find("img").attr("srcset") || $(el).find("img").attr("data-srcset") || "Resim yok";  
        let timePosted = $(el).find("span").text().trim() || "Zaman bilgisi yok";
        timePosted = timePosted
          .replace(/minut|min/g, "dakika")
          .replace(/sat|sati|sata/g, "saat");

        let timeInMinutes = 0;
        if (timePosted.includes("dakika")) {
          timeInMinutes = parseInt(timePosted.split(" ")[0]);
        } else if (timePosted.includes("saat")) {
          const hoursAgo = parseInt(timePosted.split(" ")[0]);
          timeInMinutes = hoursAgo * 60;
        } else if (timePosted.includes("gün")) {
          const daysAgo = parseInt(timePosted.split(" ")[0]);
          timeInMinutes = daysAgo * 24 * 60;
        }

        const currentTime = moment().tz(turkeyTz);
        const articleTime = currentTime.clone().subtract(timeInMinutes, 'minutes');
        if (currentTime.diff(articleTime, 'hours') <= 12) {
          if (!seenLinks.has(link)) {
            seenLinks.add(link);
            newsList.push({
              title,
              link,
              description,
              image,
              timePosted: articleTime.format("YYYY-MM-DD HH:mm"),
              articleTime
            });
          }
        } else {
          foundOldArticle = true;
        }
      });
      if (foundOldArticle) {
        break;
      }
      newsList = newsList.sort((a, b) => b.articleTime - a.articleTime);
      pageNumber++;
    } catch (err) {
      await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
      break;
    }
  }
  return newsList;
}

async function scrapeNews() {
  while (true) {
    try {
      const newArticles = await getLatestNews(url);
      const currentTime = moment().tz(turkeyTz);
      newArticles.forEach((article) => {
        const existingIndex = ARTICLES.findIndex(existing => existing.link === article.link);
        if (existingIndex !== -1) {
          const existingArticle = ARTICLES[existingIndex];
          if (article.articleTime.isAfter(existingArticle.articleTime)) {
            ARTICLES[existingIndex] = article; 
          }
        } else {
          ARTICLES.push(article);
        }
      });

      ARTICLES.sort((a, b) => b.articleTime - a.articleTime);
      ARTICLES = ARTICLES.filter((article) => {
        return currentTime.diff(article.articleTime, 'hours') <= EXPIRATION;
      });

      if (firstRun) {
        console.log("klix.ba Haberler güncelleniyor...");
      } else {
        console.log("klix.ba İlk haber çekme işlemi başlatılıyor...");
      }

      firstRun = true;
      await new Promise(resolve => setTimeout(resolve, SCRAPE_INTERVAL));
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
    }
  }
}

const startKlixNews = async () => {
  await scrapeNews();
};

const getKlixArticles = () => {
  return ARTICLES.map(article => ({
    baslik: article.title,
    aciklama: article.description,
    link: article.link,
    resim: article.image,
    timestamp: article.timePosted,
    source: "Klix.ba"
  }));
};

module.exports = { startKlixNews, getKlixArticles };