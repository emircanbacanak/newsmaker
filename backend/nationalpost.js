const axios = require("axios");
const cheerio = require("cheerio");
const moment = require("moment-timezone");

const SCRAPE_INTERVAL = 11 * 60 * 1000; // Her 2 dakikada bir
const RETRY_INTERVAL = 30 * 60 * 1000; // 30 dakika bekleme süresi

let ARTICLES = [];
const TZ = "Europe/Istanbul";

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

let isFirstRun = true;
const getNews = async (url) => {
  try {
    const { data: html } = await axios.get(url, { headers });
    const $ = cheerio.load(html);
    let newsItems = [];
    const seenTitles = new Set();
    $("article").each((index, element) => {
      const newsElem = $(element);
      let newsData = {};
      let titleTag = newsElem.find("h2, h3").first();
      const title = titleTag.text().trim() || "Başlık yok";
      if (!seenTitles.has(title)) {
        try {
          newsData.title = title;
          let href = newsElem.find("a").attr("href");
          if (href && !href.startsWith("https://")) {
            href = `https://nationalpost.com${href}`;
          }
          newsData.link = href;
          const imgTag = newsElem.find("img").attr("src");
          const imgTag2 = imgTag ? imgTag.split('.jpg')[0] + '.jpg' : "Resim yok";
          newsData.img = imgTag2 || "Resim yok";
          let time = newsElem.find(".article-card__time-clamp").text().trim();
          let timestamp;

          if (time) {
            const timeRegex = /(\d+)\s*(hours?|minutes?|seconds?|days?)\s*ago/i;
            const match = time.match(timeRegex);
            if (match) {
              const value = parseInt(match[1]);
              const unit = match[2].toLowerCase();
              if (unit.includes("hour")) {
                timestamp = moment().subtract(value, 'hours').format("YYYY-MM-DD HH:mm");
              } else if (unit.includes("minute")) {
                timestamp = moment().subtract(value, 'minutes').format("YYYY-MM-DD HH:mm");
              } else if (unit.includes("second")) {
                timestamp = moment().subtract(value, 'seconds').format("YYYY-MM-DD HH:mm");
              } else if (unit.includes("day")) {
                timestamp = moment().subtract(value, 'days').format("YYYY-MM-DD HH:mm");
              }
            } else {
              if (moment(time, "MMMM D, YYYY", true).isValid()) {
                timestamp = moment.tz(time, "MMMM D, YYYY", TZ).format("YYYY-MM-DD HH:mm");
              } else if (moment(time, "YYYY-MM-DD HH:mm", true).isValid()) {
                timestamp = moment.tz(time, "YYYY-MM-DD HH:mm", TZ).format("YYYY-MM-DD HH:mm");
              } else {
                timestamp = moment().format("YYYY-MM-DD HH:mm");
              }
            }
            newsData.timestamp = timestamp;
            newsData.publish_time = moment(timestamp).format("HH:mm");
          }

          let descriptionTag = newsElem.find("p.article-card__excerpt").text().trim();
          newsData.description = descriptionTag || "";
          if (newsData.timestamp) {
            newsData.source = "nationalpost.com";
            newsItems.push(newsData);
            seenTitles.add(title);
          }
        } catch (articleError) {
          console.error("Makale işlenirken hata oluştu: ");
        }
      }
    });

    const twelveHoursAgo = moment().subtract(12, 'hours').format("YYYY-MM-DD HH:mm");
    newsItems = newsItems.filter(item => moment(item.timestamp, "YYYY-MM-DD HH:mm").isAfter(twelveHoursAgo));
    return newsItems;
  } catch (error) {

    return [];
  }
};

const updateArticles = (newArticles) => {
  newArticles.forEach(article => {
    const existingIndex = ARTICLES.findIndex(existing => existing.link === article.link);
    
    if (existingIndex === -1) {
      ARTICLES.push(article);
    } else {
      ARTICLES[existingIndex] = { ...ARTICLES[existingIndex], ...article };
      ARTICLES[existingIndex].timestamp = moment().format("YYYY-MM-DD HH:mm");
    }
  });
  ARTICLES.sort((a, b) => {
    const timeA = moment(a.timestamp, "YYYY-MM-DD HH:mm");
    const timeB = moment(b.timestamp, "YYYY-MM-DD HH:mm");
    return timeB - timeA;
  });
};

const scrapeNews = async () => {
  let currentPageUrl = "https://nationalpost.com/category/news/canada/?more=canada";
  let shouldContinue = true;
  while (shouldContinue) {
    try {
      const newArticles = await getNews(currentPageUrl);
      updateArticles(newArticles);
      const $ = await axios.get(currentPageUrl, { headers }).then(response => cheerio.load(response.data));
      const nextPageButton = $("a.b_showmorebtn-link").attr("href");
      if (nextPageButton) {
        const nextPageUrl = `https://nationalpost.com${nextPageButton}`;
        const nextArticles = await getNews(nextPageUrl);
        updateArticles(nextArticles);
        currentPageUrl = nextPageUrl;
      } else {
        shouldContinue = false;
      }
    } catch (err) {
      console.error("nationalpost Sayfaya erişme hatası, 30 dk sonra tekrar deneniyor...");
      await delay(RETRY_INTERVAL);
    }
  }
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const computeRelativeTime = (timestampStr) => {
  if (!timestampStr) return "N/A";
  let parsedTimestamp = moment.tz(timestampStr, "YYYY-MM-DD HH:mm", TZ);
  let diff = moment().tz(TZ).diff(parsedTimestamp);
  let duration = moment.duration(diff);

  if (duration.asMinutes() < 1) return "az önce";
  if (duration.asHours() < 1) return `${Math.floor(duration.asMinutes())} dakika önce`;
  return `${Math.floor(duration.asHours())} saat ${Math.floor(duration.asMinutes() % 60)} dakika önce`;
};

const startNationalPostNews = async () => {
  console.log(isFirstRun ? "nationalpost İlk haber çekme işlemi başlatılıyor" : "nationalpost Haberler güncelleniyor...");
  isFirstRun = false;
  await scrapeNews();
  setInterval(async () => {
    console.log("nationalpost Haberler güncelleniyor...");
    try {
      await scrapeNews();
    } catch (err) {
      console.error("nationalpost Haberler güncellenirken bir hata oluştu, 30 dk sonra tekrar deneniyor...");
      await delay(RETRY_INTERVAL);
    }
  }, SCRAPE_INTERVAL);
};

const getNationalPostArticles = () => {
  return ARTICLES.map(article => ({
    baslik: article.title,
    aciklama: article.description,
    link: article.link,
    resim: article.img,
    timestamp: article.timestamp,
    relative_time: computeRelativeTime(article.timestamp),
    publish_time: article.publish_time,
    source: "nationalpost.com",
  }));
};

module.exports = { startNationalPostNews, getNationalPostArticles };
