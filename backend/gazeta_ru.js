const axios = require("axios");
const cheerio = require("cheerio");
const moment = require("moment-timezone");

const SCRAPE_INTERVAL = 10 * 60 * 1000; // 5 dakika
const EXPIRATION = 12 * 60 * 60 * 1000; // 12 saat
const RETRY_INTERVAL = 30 * 60 * 1000; // 30 dakika sonra tekrar deneme
let ARTICLES = [];
const TZ = "Europe/Istanbul";

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
  'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36'
];

const getNews = async (url) => {
  try {
    const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    const response = await axios.get(url, {
      timeout: 15000,
      maxRedirects: 3,
      headers: {
        'User-Agent': randomUserAgent,
        'Connection': 'close'
      }
    });
    
    const $ = cheerio.load(response.data);
    let newsItems = [];

    $("a.b_ear.m_techlisting").each((index, element) => {
      const newsElem = $(element);
      let newsData = {};
      let titleTag = newsElem.find("div.b_ear-textblock div.b_ear-title");
      newsData.title = titleTag.text().trim() || "No title";
      let href = newsElem.attr("href");
      if (href) {
        if (!href.startsWith("https://")) {
          href = `https://www.gazeta.ru${href}`;
        }
      }
      newsData.link = href;
      const imgTag = newsElem.find("div.b_ear-image img");
      newsData.img = imgTag.attr("src") || "No image";
      const timeTag = newsElem.find("time.b_ear-time");

      if (timeTag.length) {
        const rawTime = timeTag.attr("datetime");
        if (rawTime) {
          const timestamp = moment.tz(rawTime, TZ);
          newsData.timestamp = timestamp.format("YYYY-MM-DD HH:mm");
          newsData.publish_time = timestamp.format("HH:mm");
        }
      }
      if (newsData.timestamp) {
        newsData.source = "gazeta.ru";
        newsItems.push(newsData);
      }
    });

    newsItems = newsItems.filter(item => {
      let timestamp = moment(item.timestamp, "YYYY-MM-DD HH:mm");
      return moment().diff(timestamp, 'hours') <= EXPIRATION;
    });

    return newsItems;
  } catch (error) {
    console.error("Hata:", error.message);
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.response?.status === 404) {
      console.error('Gazeta Bağlantı hatası, yeniden deniyorum...');
      setTimeout(() => getNews(url), RETRY_INTERVAL);
    } else {
      return [];
    }
    return [];
  }
};

const loadMoreNews = async (nextPageUrl) => {
  try {
    const newsItems = await getNews(nextPageUrl);
    return newsItems;
  } catch (error) {
    console.error("gazeta Daha fazla haber çekme hatası:");
    return [];
  }
};

const updateArticles = (newArticles) => {
  newArticles.forEach(article => {
    const existingIndex = ARTICLES.findIndex(existing => existing.link === article.link);
    if (existingIndex === -1) {
      ARTICLES.push(article);
    } else {
      ARTICLES[existingIndex] = article;
    }
  });
  ARTICLES = ARTICLES.filter(article => {
    let timestamp = moment(article.timestamp, "YYYY-MM-DD HH:mm");
    return moment().diff(timestamp, 'hours') <= EXPIRATION;
  });
  ARTICLES.sort((a, b) => {
    const timeA = moment(a.timestamp, "YYYY-MM-DD HH:mm");
    const timeB = moment(b.timestamp, "YYYY-MM-DD HH:mm");
    return timeB - timeA;
  });
};

const scrapeNews = async () => {
  let currentPageUrl = "https://www.gazeta.ru/news/";
  let shouldContinue = true;

  while (shouldContinue) {
    const newArticles = await getNews(currentPageUrl);
    updateArticles(newArticles);
    
    const oldestArticle = newArticles.find(article => {
      const timestamp = moment(article.timestamp, "YYYY-MM-DD HH:mm");
      return moment().diff(timestamp, "hours") >= EXPIRATION;
    });

    if (oldestArticle) {
      shouldContinue = false;
    } else {
      const $ = await axios.get(currentPageUrl).then(response => cheerio.load(response.data));
      const nextPageButton = $("a.b_showmorebtn-link").attr("href");

      if (nextPageButton) {
        const nextPageUrl = `https://www.gazeta.ru${nextPageButton}`;
        const nextArticles = await loadMoreNews(nextPageUrl);
        updateArticles(nextArticles);
        currentPageUrl = nextPageUrl;
      } else {
        shouldContinue = false;
      }
    }
  }
};

const computeRelativeTime = (timestampStr) => {
  if (!timestampStr) return "N/A";
  let parsedTimestamp = moment.tz(timestampStr, "YYYY-MM-DD HH:mm", TZ);
  let diff = moment().tz(TZ).diff(parsedTimestamp);
  let duration = moment.duration(diff);
  if (duration.asMinutes() < 1) return "az önce";
  if (duration.asHours() < 1) return `${Math.floor(duration.asMinutes())} dakika önce`;
  return `${Math.floor(duration.asHours())} saat ${Math.floor(duration.asMinutes() % 60)} dakika önce`;
};

function startGazetaScraper() {
  console.log("Gazeta İlk haber çekme işlemi başlatılıyor...");
  scrapeNews();
  setInterval(() => {
    console.log("Gazeta Haberler güncelleniyor...");
    scrapeNews();
  }, SCRAPE_INTERVAL);
}

function getGazetaArticles() {
  return ARTICLES.map(article => ({
    baslik: article.title,
    aciklama: "",
    link: article.link,
    resim: article.img,
    timestamp: article.timestamp,
    relative_time: article.timestamp ? computeRelativeTime(article.timestamp) : "N/A",
    publish_time: article.publish_time,
    source: article.source
  }));
}

module.exports = { startGazetaScraper, getGazetaArticles };
