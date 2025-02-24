const puppeteer = require("puppeteer-extra");
const puppeteerStealth = require("puppeteer-extra-plugin-stealth");
const cheerio = require("cheerio");
const moment = require("moment-timezone");

puppeteer.use(puppeteerStealth());
const SCRAPE_INTERVAL = 5 * 60 * 1000; // 5 dakika
const RETRY_INTERVAL = 30 * 60 * 1000; // 30 dakika
let ARTICLES = new Set();
let isFirstRun = true;

const getArticlePublishDate = async (url, browser, retryCount = 0) => {
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "load", timeout: 20000 });

    let publishDate = "";
    try {
      publishDate = await page.$eval("p.article-header__publish-date", el => el.innerText);
    } catch (e) {
      publishDate = "";
    }
    publishDate = publishDate.replace("Posted on", "").trim();
    const regex = /([A-Za-z]+ \d{1,2}, \d{4} \d{1,2}:\d{2}(?: [APM]+)?)/;
    const match = publishDate.match(regex);
    let result = "";
    if (match) {
      const formattedDate = match[1];
      const africaDate = moment.tz(formattedDate, "MMMM DD, YYYY hh:mm A", "Africa/Johannesburg");
      result = africaDate.tz("Europe/Istanbul").format("YYYY-MM-DD HH:mm:ss");
    }
    await page.close();
    return result;
  } catch (error) {
    if (retryCount < 1) {
      console.log(`theafricareport 1 dakika sonra tekrar denenecek: ${url}`);
      await new Promise(resolve => setTimeout(resolve, 60000)); // 1 dakika bekle
      return getArticlePublishDate(url, browser, retryCount + 1); // Tekrar dene
    } else {
      return null;
    }
  }
};


const getAfricaNews = async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
  );

  try {
    await page.goto("https://www.theafricareport.com/", { waitUntil: "load", timeout: 10000 });
    await page.waitForSelector("#didomi-notice-agree-button", { timeout: 10000 }).then(button => button.click()).catch(() => {});
    const content = await page.content();
    const $ = cheerio.load(content);
    let newsItems = new Set();

    const extractNews = async (index, element) => {
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
      newsData.description = descriptionTag.text().trim() || "";
      newsData.timestamp = await getArticlePublishDate(newsData.link, browser);
      if (newsData.timestamp) {
        newsItems.add(JSON.stringify(newsData));
      }
    };

    await Promise.all($(".homepage-main .thumbnail, .homepage-main .card").map(extractNews).get());
    await Promise.all($(".articles-list .articles-list__post .card.horizontal").map(extractNews).get());
    await Promise.all($(".swiper .swiper-slide .card.slider").map(extractNews).get());
    await browser.close();
    return Array.from(newsItems).map(item => JSON.parse(item));
  } catch (error) {
    console.error("theafricareport Sayfaya erişme hatası: 30 dakika sonra tekrar denenecek...");
    await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
    return [];
  }
};

const scrapeNews = async () => {
  try {
    const newArticles = await getAfricaNews();
    let updatedArticles = new Set([...ARTICLES]);
    const twelveHoursAgo = moment().subtract(12, "hours");

    newArticles.forEach(article => {
      const articleTimestamp = moment(article.timestamp, "YYYY-MM-DD HH:mm:ss");
      if (articleTimestamp.isSameOrAfter(twelveHoursAgo)) {
        updatedArticles.add(JSON.stringify(article));
      }
    });

    ARTICLES = new Set([...updatedArticles]);
    if (isFirstRun) {
      console.log("theafricareport İlk haber çekme işlemi başlatılıyor...");
      isFirstRun = false;
    } else {
      console.log("theafricareport Haberler güncelleniyor...");
    }
  } catch (error) {
    console.error("theafricareport İnternet hatası: 30 dakika sonra tekrar denenecek...");
    await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
  }
  setTimeout(scrapeNews, SCRAPE_INTERVAL);
};

function getAfricaReportArticles() {
  return Array.from(ARTICLES)
    .map(art => JSON.parse(art))
    .sort((a, b) => moment(b.timestamp).diff(moment(a.timestamp)))
    .map(art => ({
      baslik: art.title,
      aciklama: art.description || "",
      link: art.link,
      resim: art.img,
      timestamp: art.timestamp,
      source: "theafricareport.com"
    }));
}

function startAfricaReportScraper() {
  scrapeNews();
}

module.exports = { startAfricaReportScraper, getAfricaReportArticles };
