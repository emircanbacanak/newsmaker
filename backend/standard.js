const axios = require("axios");
const cheerio = require("cheerio");
const path = require("path");
const fs = require("fs");

let ARTICLES = [];
let blackList = [];
let firstRun = true;
const blackListFilePath = path.join(__dirname, "blackList.json");

const TWELVE_HOURS = 12 * 60 * 60 * 1000;
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

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
    let newsItems = [];
    $(".sc-heXsO").each((i, el) => {
      const title = $(el).find("a.sc-ieQsNB").text().trim();
      let link = $(el).find("a.sc-ieQsNB").attr("href");
      if (link && !link.startsWith("https://")) {
        link = "https://www.standard.co.uk" + link;
      }
      
      const image = $(el).find("picture img").attr("src") || "";
      const publishedAt = new Date().toISOString();
      if (title && link) {
        newsItems.push({
          title,
          description: "",
          link,
          img: image,
          category: "headline",
          timestamp: publishedAt,
          source: "standard.co.uk",
        });
      }
    });

    $(".sc-emIrwa").each((i, el) => {
      const title = $(el).find("p.sc-kgOKUu").text().trim();
      let link = $(el).find("a.sc-iHbSHJ").attr("href");
      if (link && !link.startsWith("https://")) {
        link = "https://www.standard.co.uk" + link;
      }

      const image = $(el).find("picture img").attr("src") || "";
      const publishedAt = new Date().toISOString();
      if (title && link) {
        newsItems.push({
          title,
          description: "",
          link,
          img: image,
          category: "sub_news",
          timestamp: publishedAt,
          source: "standard.co.uk",
        });
      }
    });

    $(".sc-camqpD").each((i, el) => {
      const title = $(el).find("p.sc-jdkBTo").text().trim();
      let link = $(el).find("a.sc-iHbSHJ").attr("href");
      if (link && !link.startsWith("https://")) {
        link = "https://www.standard.co.uk" + link;
      }

      const image = $(el).find("picture img").attr("src") || "";
      const publishedAt = new Date().toISOString();
      if (title && link) {
        newsItems.push({
          title,
          description: "",
          link,
          img: image,
          category: "other",
          timestamp: publishedAt,
          source: "standard.co.uk",
        });
      }
    });
    return newsItems;
  } catch (error) {
    console.error("Haber çekme hatası:", error);
    return [];
  }
};

const saveBlackList = () => {
  fs.writeFileSync(blackListFilePath, JSON.stringify(blackList, null, 2), "utf8");
};

const loadBlackList = () => {
  if (fs.existsSync(blackListFilePath)) {
    const data = fs.readFileSync(blackListFilePath, "utf8");
    return JSON.parse(data);
  }
  return [];
};

const cleanOldBlackList = () => {
  const currentTime = Date.now();
  let changed = false;
  blackList = blackList.filter(item => {
    const age = currentTime - new Date(item.blacklistedAt).getTime();
    if (age >= THIRTY_DAYS) {
      console.log(`Blacklist'ten silinen haber: ${item.link}`);
      changed = true;
      return false;
    }
    return true;
  });
  if (changed) {
    saveBlackList();
  }
};

const startstandard = async () => {
  blackList = loadBlackList();
  cleanOldBlackList();
  let blacklistChanged = false;
  ARTICLES = ARTICLES.filter(article => {
    const age = Date.now() - new Date(article.timestamp).getTime();
    if (age >= TWELVE_HOURS) {
      if (!blackList.some(item => item.link === article.link)) {
        blackList.push({ link: article.link, blacklistedAt: new Date().toISOString() });
        blacklistChanged = true;
      }
      return false;
    }
    return true;
  });

  try {
    const newArticles = await getNews();
    if (firstRun) {
      newArticles.forEach(article => {
        if (!blackList.some(item => item.link === article.link)) {
          blackList.push({ link: article.link, blacklistedAt: new Date().toISOString() });
        }
      });
      saveBlackList();
    }

    newArticles.forEach(article => {
      const age = Date.now() - new Date(article.timestamp).getTime();
      if (age < TWELVE_HOURS &&
          !ARTICLES.some(existing => existing.link === article.link) &&
          !blackList.some(item => item.link === article.link)) {
        ARTICLES.push(article);
      }
    });

    if (firstRun) {
      firstRun = false;
    }
  } catch (error) {
    console.error("startstandard hatası:", error);
  }

  if (blacklistChanged) {
    saveBlackList();
  }

  // Her dakika bir demo haber ekliyoruz.
  const demoArticle = {
    title: "Demo Haber Başlığı",
    description: "Bu bir demo haber açıklamasıdır.",
    link: "https://www.standard.co.uk/demo-link",
    img: "https://example.com/demo-image.jpg",
    category: "demo",
    timestamp: new Date().toISOString(),
    source: "standard.co.uk",
  };
  ARTICLES.push(demoArticle);

  setTimeout(startstandard, 120000);
  console.log("standard Haberler güncelleniyor...");
};

const getStandardArticles = () => {
  const sortedArticles = ARTICLES.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return sortedArticles.map(art => ({
    baslik: art.title,
    aciklama: art.description,
    link: art.link,
    resim: art.img,
    timestamp: art.timestamp,
    source: art.source,
  }));
};

module.exports = { startstandard, getStandardArticles };
