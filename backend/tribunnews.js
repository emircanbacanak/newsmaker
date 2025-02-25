const axios = require("axios");
const cheerio = require("cheerio");
const path = require("path");
const fs = require("fs");

const SCRAPE_INTERVAL = 5 * 60 * 1000; // 5 dakika
const RETRY_INTERVAL = 30 * 60 * 1000; // 30 dakika
const BLACKLIST_EXPIRATION = 7 * 24 * 60 * 60 * 1000; // 7 gün

let ARTICLES = new Set();
let blackList = [];
let firstRun = true;
const blackListFilePath = path.join(__dirname, "blackList.json");

const loadBlackList = () => {
  if (fs.existsSync(blackListFilePath)) {
    try {
      const data = fs.readFileSync(blackListFilePath, "utf8");
      return JSON.parse(data);
    } catch (err) {
      console.error("standard Blacklist okuma hatası:", err.message);
      return [];
    }
  }
  return [];
};

const saveBlackList = () => {
  try {
    fs.writeFileSync(blackListFilePath, JSON.stringify(blackList, null, 2), "utf8");
  } catch (err) {
    console.error("standard Blacklist yazma hatası:", err.message);
  }
};

const cleanOldBlackList = () => {
  const now = Date.now();
  let changed = false;
  blackList = blackList.filter(item => {
    const age = now - new Date(item.blacklistedAt).getTime();
    if (age >= BLACKLIST_EXPIRATION) {
      console.log(`Blacklist'ten silinen haber: ${item.link}`);
      changed = true;
      return false;
    }
    return true;
  });
  if (changed) saveBlackList();
};

const getNews = async () => {
  const url = "https://www.standard.co.uk/news";
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.6943.60 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    const $ = cheerio.load(response.data);
    let newsItems = new Set();

    $(".sc-heXsO").each((i, el) => {
      const title = $(el).find("a.sc-ieQsNB").text().trim();
      if (!title) return;
      let link = $(el).find("a.sc-ieQsNB").attr("href");
      if (link && !link.startsWith("https://")) {
        link = "https://www.standard.co.uk" + link;
      }
      if (blackList.some(item => item.link === link)) return;
      const image = $(el).find("picture img").attr("src") || "";
      const publishedAt = new Date().toISOString();
      newsItems.add(JSON.stringify({
        title,
        link,
        img: image,
        timestamp: publishedAt,
        source: "standard.co.uk",
      }));
    });

    $(".sc-emIrwa").each((i, el) => {
      const title = $(el).find("p.sc-kgOKUu").text().trim();
      if (!title) return;
      let link = $(el).find("a.sc-iHbSHJ").attr("href");
      if (link && !link.startsWith("https://")) {
        link = "https://www.standard.co.uk" + link;
      }
      if (blackList.some(item => item.link === link)) return;
      const image = $(el).find("picture img").attr("src") || "";
      const publishedAt = new Date().toISOString();
      newsItems.add(JSON.stringify({
        title,
        link,
        img: image,
        timestamp: publishedAt,
        source: "standard.co.uk",
      }));
    });

    return Array.from(newsItems).map(item => JSON.parse(item));
  } catch (error) {
    console.error("Standard Sayfaya erişme hatası: 30 dakika sonra tekrar denenecek...", error.message);
    await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
    return [];
  }
};

const scrapeNews = async () => {
  try {
    blackList = loadBlackList();
    cleanOldBlackList();
    const newArticles = await getNews();
    let updated = false;
    newArticles.forEach(article => {
      if (!blackList.some(item => item.link === article.link)) {
        blackList.push({ link: article.link, blacklistedAt: new Date().toISOString() });
        ARTICLES.add(JSON.stringify(article));
        updated = true;
      }
    });

    if (updated) saveBlackList();
    if (firstRun) {
      console.log("standard İlk haber çekme işlemi başlatılıyor...");
      firstRun = false;
    } else {
      console.log("standard Haberler güncelleniyor...");
    }
  } catch (error) {
    console.error("standard İnternet hatası: 30 dakika sonra tekrar denenecek...", error.message);
    await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
  }
  setTimeout(scrapeNews, SCRAPE_INTERVAL);
};

function getStandardArticles() {
  return Array.from(ARTICLES)
    .map(item => JSON.parse(item))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .map(art => ({
      baslik: art.title,
      link: art.link,
      resim: art.img,
      timestamp: art.timestamp,
      source: art.source,
    }));
}

function startStandardScraper() {
  scrapeNews();
}

module.exports = { startStandardScraper, getStandardArticles };
