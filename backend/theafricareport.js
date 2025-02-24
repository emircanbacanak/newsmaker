const express = require("express");
const puppeteer = require("puppeteer-extra");
const puppeteerStealth = require("puppeteer-extra-plugin-stealth");
const cheerio = require("cheerio");
const path = require("path");
const moment = require("moment-timezone");

const app = express();
const PORT = 3000;
let ARTICLES = [];

puppeteer.use(puppeteerStealth());

const getArticlePublishDate = async (url, browser) => {
  try {
    const page = await browser.newPage();
    // Daha hızlı veri çekimi için waitUntil: "domcontentloaded" ve kısa timeout
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    
    // Sayfa içeriğini tamamen çekmek yerine doğrudan elementin innerText'ini alıyoruz
    let publishDate = "";
    try {
      publishDate = await page.$eval("p.article-header__publish-date", el => el.innerText);
    } catch (e) {
      publishDate = "";
    }
    publishDate = publishDate.replace("Posted on", "").trim();
    const regex = /([A-Za-z]+ \d{1,2}, \d{4} \d{1,2}:\d{2}(?: [APM]+)?)/;
    const match = publishDate.match(regex);

    let result;
    if (match) {
      const formattedDate = match[1];
      const africaDate = moment.tz(formattedDate, "MMMM DD, YYYY hh:mm A", "Africa/Johannesburg");
      result = africaDate.tz("Europe/Istanbul").format("YYYY-MM-DD HH:mm:ss");
    } else {
      result = "Unknown date";
    }
    await page.close();
    return result;
  } catch (error) {
    console.error(`Error fetching publish date for ${url}:`, error);
    return "Unknown date";
  }
};

const getAfricaNews = async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36");
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  });

  // Ana sayfanın daha hızlı yüklenmesi için "domcontentloaded" kullanıyoruz
  await page.goto("https://www.theafricareport.com/", { waitUntil: "domcontentloaded" });

  try {
    await page.waitForSelector("#didomi-notice-agree-button", { timeout: 1000 });
    await page.click("#didomi-notice-agree-button");
  } catch (error) {
    console.log("Çerez ekranı bulunamadı, devam ediliyor...");
  }

  const content = await page.content();
  const $ = cheerio.load(content);
  let newsItems = [];

  $(".homepage-main .thumbnail, .homepage-main .card").each((index, element) => {
    let newsData = {};
    const titleTag = $(element).find("a.thumbnail__title, a.card__title");
    newsData.title = titleTag.text().trim() || "No title";
    newsData.link = titleTag.attr("href") || "";
    if (!newsData.link.startsWith("https://")) {
      newsData.link = `https://www.theafricareport.com${newsData.link}`;
    }
    const imgTag = $(element).find("img");
    newsData.img = imgTag.attr("data-src") || imgTag.attr("src") || "";
    const descriptionTag = $(element).find("p.thumbnail__paragraph, a.card__description");
    newsData.description = descriptionTag.text().trim() || "No description";
    const authorTag = $(element).find("span.author");
    newsData.author = authorTag.text().trim() || "Unknown author";
    newsItems.push(newsData);
  });

  $(".articles-list .articles-list__post .card.horizontal").each((index, element) => {
    let newsData = {};
    const titleTag = $(element).find("a.card__title");
    newsData.title = titleTag.text().trim() || "No title";
    newsData.link = titleTag.attr("href") || "";
    if (!newsData.link.startsWith("https://")) {
      newsData.link = `https://www.theafricareport.com${newsData.link}`;
    }
    const imgTag = $(element).find(".card__image img");
    newsData.img = imgTag.attr("data-src") || imgTag.attr("src") || "";
    const descriptionTag = $(element).find("a.card__description");
    newsData.description = descriptionTag.text().trim() || "No description";
    const categoryTag = $(element).find("p.card__tag");
    newsData.category = categoryTag.text().trim() || "General";
    newsItems.push(newsData);
  });

  $(".swiper .swiper-slide .card.slider").each((index, element) => {
    let newsData = {};
    const titleTag = $(element).find("a.card__title");
    newsData.title = titleTag.text().trim() || "No title";
    newsData.link = titleTag.attr("href") || "";
    if (!newsData.link.startsWith("https://")) {
      newsData.link = `https://www.theafricareport.com${newsData.link}`;
    }
    const imgTag = $(element).find(".card__image img");
    newsData.img = imgTag.attr("data-src") || imgTag.attr("src") || "";
    const descriptionTag = $(element).find("a.card__description");
    newsData.description = descriptionTag.text().trim() || "No description";
    const categoryTag = $(element).find("p.card__tag");
    newsData.category = categoryTag.text().trim() || "General";
    newsItems.push(newsData);
  });

  // Tüm haberlerin timestamp bilgisini paralel olarak çekiyoruz
  await Promise.all(newsItems.map(async (news) => {
    news.timestamp = await getArticlePublishDate(news.link, browser);
  }));

  await browser.close();
  return newsItems;
};

const scrapeNews = async () => {
  try {
    const newArticles = await getAfricaNews();
    let newArticlesToAdd = [];
    const now = moment().tz("Europe/Istanbul"); 
    const twelveHoursAgo = now.clone().subtract(12, "hours");

    newArticles.forEach((article) => {
      const articleTimestamp = moment.tz(article.timestamp, "YYYY-MM-DD HH:mm:ss", "Europe/Istanbul");
      if (articleTimestamp.isSameOrAfter(twelveHoursAgo)) {
        const existingIndex = ARTICLES.findIndex((existing) => existing.link === article.link);
        if (existingIndex !== -1) {
          ARTICLES[existingIndex] = article;
        } else {
          newArticlesToAdd.push(article);
        }
      }
    });

    if (newArticlesToAdd.length > 0) {
      ARTICLES = [...newArticlesToAdd, ...ARTICLES];
    }
  } catch (error) {
    console.error("ScrapeNews Hatası:", error);
  }
  setTimeout(scrapeNews, 60000);
  console.log("Haberler güncellendi...");
};

const sortArticlesByTimestamp = (articles) => {
  return articles.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

app.use(express.static(path.join(__dirname, "../frontend")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let lastData = "";
  const sendData = () => {
    const sortedArticles = sortArticlesByTimestamp(ARTICLES);
    const data = JSON.stringify(
      sortedArticles.map((art) => ({
        baslik: art.title,
        aciklama: art.description,
        link: art.link,
        resim: art.img,
        author: art.author,
        timestamp: art.timestamp,
      }))
    );
    if (data !== lastData) {
      res.write(`data: ${data}\n\n`);
      lastData = data;
    }
  };
  const interval = setInterval(sendData, 1000);
  req.on("close", () => clearInterval(interval));
});

app.listen(PORT, () => {
  console.log(`Server ${PORT} portunda çalışıyor...`);
  scrapeNews();
});
