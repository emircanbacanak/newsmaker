const axios = require("axios");
const cheerio = require("cheerio");
const moment = require("moment-timezone");

const indiaTz = "Asia/Kolkata";
const turkeyTz = "Europe/Istanbul";
const url = "https://www.hindustantimes.com";

let ARTICLES = [];
let seenTitles = new Set();
let isFirstRun = true;

const SCRAPE_INTERVAL = 5 * 60 * 1000;
const EXPIRATION = 12 * 60 * 60 * 1000; // 12 saat
const RETRY_INTERVAL = 30 * 60 * 1000;  // 30 dakika

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
};

function getImageUrl(element) {
  let imgUrl =
    element.find("figure img").attr("data-src") ||
    element.find("figure img").attr("src") ||
    "No image";
  if (imgUrl.startsWith("//")) {
    imgUrl = "https:" + imgUrl;
  }
  if (imgUrl.startsWith("data:image")) {
    imgUrl = "No image";
  }
  return imgUrl;
}

function normalizeTitle(title) {
  return title
    .replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeLink(link) {
  return link.split("?")[0].replace(/\/$/, "").trim();
}

async function validateArticles(articles) {
  const validated = await Promise.all(
    articles.map(async (article) => {
      try {
        await axios.head(article.link, { timeout: 15000 });
        return article;
      } catch (e) {
        return null;
      }
    })
  );
  return validated.filter((a) => a !== null);
}

async function getNews() {
  try {
    const response = await axios.get(url, { headers });
    const $ = cheerio.load(response.data);
    const currentTime = moment().tz(turkeyTz);
    let articles = [];

    $(".cartHolder").each((i, el) => {
      const element = $(el);
      let link = element.find("a.storyLink").attr("href") || "";
      const title = element.find("h2.hdg3, h3.hdg3").text().trim() || null;
      const description = element.find("h2.sortDec").text().trim() || null;
      const imageUrl = getImageUrl(element);
      let timestampText = element.find(".dateTime").text().trim() || null;

      if (link) {
        link = normalizeLink(url + link);
      }

      if (timestampText) {
        timestampText = timestampText
          .replace("Published on", "")
          .replace("Updated on", "")
          .trim();
        let timestamp = moment.tz(timestampText, "MMMM D, YYYY h:mm A", indiaTz);
        if (timestamp.isValid()) {
          timestamp = timestamp.tz(turkeyTz).format("YYYY-MM-DD HH:mm");
          const timeDiff = currentTime.diff(
            moment(timestamp, "YYYY-MM-DD HH:mm"),
            "hours"
          );
          if (timeDiff <= 12 && title && !seenTitles.has(normalizeTitle(title))) {
            seenTitles.add(normalizeTitle(title));
            articles.push({
              title: normalizeTitle(title),
              link,
              time: timestamp,
              description,
              image_url: imageUrl,
            });
          }
        }
      }
    });
    articles = await validateArticles(articles);
    return articles;
  } catch (err) {
    console.error("hindustantimes Haberleri çekerken hata oluştu:");
    // İnternet veya sayfa erişim hatası durumunda 30 dakika sonra tekrar dene
    setTimeout(() => {
      scrapeNews();
    }, RETRY_INTERVAL);
    return [];
  }
}

async function scrapeNews() {
  try {
    if (isFirstRun) {
      console.log("hindustantimes İlk haber çekme işlemi başlatılıyor...");
      isFirstRun = false;
    } else {
      console.log("hindustantimes Haberler güncelleniyor...");
    }
    const newArticles = await getNews();
    const currentTime = moment().tz(turkeyTz);
    let updatedArticles = [];
    const seenArticles = new Set(
      ARTICLES.map((article) =>
        JSON.stringify({ title: article.title, link: article.link })
      )
    );
    newArticles.forEach((article) => {
      const articleKey = JSON.stringify({
        title: article.title,
        link: article.link,
      });
      if (!seenArticles.has(articleKey)) {
        seenArticles.add(articleKey);
        updatedArticles.push(article);
      }
    });
    updatedArticles = [...ARTICLES, ...updatedArticles].filter((article) =>
      currentTime.diff(moment(article.time, "YYYY-MM-DD HH:mm"), "hours") <= EXPIRATION
    );
    updatedArticles.sort(
      (a, b) =>
        moment(b.time, "YYYY-MM-DD HH:mm").valueOf() -
        moment(a.time, "YYYY-MM-DD HH:mm").valueOf()
    );
    ARTICLES = updatedArticles;
  } catch (error) {
    console.error("hindustantimes ScrapeNews hatası:");
    // Hata durumunda 30 dakika sonra tekrar denenecek
    setTimeout(() => {
      scrapeNews();
    }, RETRY_INTERVAL);
  }
}

async function startHindustanTimesScraper() {
  await scrapeNews();
  setInterval(async () => {
    await scrapeNews();
  }, SCRAPE_INTERVAL);
}

function getHindustanTimesArticles() {
  return ARTICLES.map((article) => ({
    baslik: article.title,
    aciklama: article.description,
    link: article.link,
    resim: article.image_url,
    timestamp: article.time,
    source: "hindustantimes.com",
  }));
}

module.exports = { startHindustanTimesScraper, getHindustanTimesArticles };
