const puppeteer = require("puppeteer-extra");
const puppeteerStealth = require("puppeteer-extra-plugin-stealth");
const cheerio = require("cheerio");
const moment = require("moment-timezone");

puppeteer.use(puppeteerStealth());

const SCRAPE_INTERVAL = 5 * 60 * 1000; // 5 dakika
const RETRY_INTERVAL = 30 * 60 * 1000; // 30 dakika
const EXPIRATION = 12 * 60 * 60 * 1000; // 12 saat
const ARTICLES = new Set();
let isFirstRun = true;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getArticlePublishDate = async (url, browser) => {
  try {
    await delay(2000);
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "load", timeout: 30000 });
    
    let publishDate = "";
    try {
      publishDate = await page.$eval("p.article-header__publish-date", el => el.innerText);
    } catch (e) {
      await page.close();
      return null;
    }

    publishDate = publishDate.replace("Posted on", "").trim();
    moment.locale('en');
    let result = "";
    if (publishDate) {
      const africaDate = moment.tz(publishDate, "MMMM DD, YYYY HH:mm", "en", "Africa/Johannesburg");
      if (africaDate.isValid()) {
        result = africaDate.tz("Europe/Istanbul").format("YYYY-MM-DD HH:mm:ss");
      } else {
        console.error(`Geçersiz tarih formatı: ${publishDate}`);
      }
    }
    
    await page.close();
    return result || null;
  } catch (error) {
    return null;
  }
};

const getAfricaNews = async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36");

  try {
    await page.goto("https://www.theafricareport.com/", { waitUntil: "load", timeout: 10000 });
    await page.waitForSelector("#didomi-notice-agree-button", { timeout: 10000 })
      .then(button => button.click())
      .catch(() => {});

    const content = await page.content();
    const $ = cheerio.load(content);
    let newsItems = new Set();
    let newsLinks = [];

    $(".homepage-main .thumbnail, .homepage-main .card, .articles-list .articles-list__post .card.horizontal, .swiper .swiper-slide .card.slider").each((index, element) => {
      const titleTag = $(element).find("a.thumbnail__title, a.card__title");
      let link = titleTag.attr("href") || "";
      if (!link.startsWith("https://")) {
        link = `https://www.theafricareport.com${link}`;
      }
      newsLinks.push(link);
    });

    for (let i = 0; i < newsLinks.length; i += 2) {
      let newsDataArray = await Promise.all(
        newsLinks.slice(i, i + 2).map(async (link) => {
          return await getArticlePublishDate(link, browser).then((timestamp) => {
            return { link, timestamp };
          });
        })
      );

      newsDataArray.forEach(newsData => {
        if (newsData.timestamp) {
          newsItems.add(JSON.stringify(newsData));
        }
      });
    }

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
    const expirationTime = moment().subtract(EXPIRATION, "hours");

    newArticles.forEach(article => {
      const articleTimestamp = moment(article.timestamp, "YYYY-MM-DD HH:mm:ss");
      if (articleTimestamp.isSameOrAfter(expirationTime)) {
        updatedArticles.add(JSON.stringify(article));
      }
    });

    ARTICLES.clear();
    updatedArticles.forEach(article => ARTICLES.add(article));

    if (isFirstRun) {
      console.log("theafricareport İlk haber çekme işlemi başlatılıyor...");
      isFirstRun = false;
    } else {
      console.log("theafricareport Haberler güncelleniyor...");
    }
  } catch (error) {
    console.error("theafricareport Hata oluştu, 30 dakika sonra tekrar denenecek...");
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
