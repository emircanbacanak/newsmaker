const axios = require("axios");
const cheerio = require("cheerio");
const moment = require("moment-timezone");
const http = require("http");
const https = require("https");

const TZ = "Europe/Istanbul";
const SCRAPE_INTERVAL = 5 * 60 * 1000; // 5 dakika
const EXPIRATION = 12 * 60 * 60 * 1000; // 12 saat
const RETRY_DELAY = 30 * 60 * 1000; // 30 dakika

let ARTICLES = [];
let ARTICLE_LINKS = new Set();
let firstRun = true;

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

const axiosInstance = axios.create({
  httpAgent,
  httpsAgent,
  timeout: 35000,
});

const fetchArticleTime = async (link) => {
  try {
    const response = await axiosInstance.get(link);
    const $ = cheerio.load(response.data);
    let timeElement = $('ul.article__time li.article__updated time');
    if (timeElement.length > 0) {
      return timeElement.attr("datetime");
    } else {
      timeElement = $('ul.article__time li.article__published time');
      if (timeElement.length > 0) {
        return timeElement.attr("datetime");
      }
    }
    return null;
  } catch (error) {
    console.error("thesun.co.uk Haber zaman bilgisi çekerken hata oluştu, haber siliniyor:", link);
    ARTICLE_LINKS.delete(link);
    return null;
  }
};

const getImageFromVideo = (videoElement) => {
  const poster = videoElement.attr("poster");
  if (poster) {
    const baseUrl = "https://www.thesun.co.uk";
    if (poster.startsWith("/wp-content")) {
      return baseUrl + poster.split("?")[0];
    }
    return poster.split("?")[0]; 
  }
  return null;
};

const getNews = async () => {
  const url = "https://www.thesun.co.uk/";
  try {
    const response = await axiosInstance.get(url);
    const $ = cheerio.load(response.data);
    let newsItems = [];

    $(".teaser-item").each((index, element) => {
      const item = $(element);
      const title = item.find("a.text-anchor-wrap").attr("data-headline")?.trim() || "";
      if (!title) return;
      let link = item.find("a.text-anchor-wrap").attr("href") || "";
      if (link && !link.startsWith("https://")) {
        link = `https://www.thesun.co.uk${link}`;
      }

      let img = item.find("div.teaser__image-container picture img").attr("src") || "No image";
      if (img === "No image") {
        const videoElement = item.find("div.teaser__image-anchor-tag video");
        img = getImageFromVideo(videoElement) || "No image";
      }

      const description = item.find("p.teaser__lead").text().trim() || "";
      const timestamp = moment().tz(TZ).format("YYYY-MM-DD HH:mm");
      const publish_time = moment().tz(TZ).format("HH:mm");

      if (!ARTICLE_LINKS.has(link)) {
        newsItems.push({ title, link, img, description, timestamp, publish_time, source: "thesun.co.uk" });
      }
    });

    newsItems.forEach(article => ARTICLE_LINKS.add(article.link));
    const newsWithTime = await Promise.allSettled(
      newsItems.map(async (article) => {
        if (article.link.startsWith("https://www.thesun.co.uk")) {
          const articleDatetime = await fetchArticleTime(article.link);
          if (articleDatetime) {
            article.timestamp = moment.tz(articleDatetime, TZ).format("YYYY-MM-DD HH:mm");
            article.publish_time = moment.tz(articleDatetime, TZ).format("HH:mm");
          }
        }
        return article;
      })
    );

    const updatedNews = newsWithTime
      .filter(result => result.status === "fulfilled")
      .map(result => result.value);
    ARTICLES = [...updatedNews, ...ARTICLES].slice(0, 100);
    ARTICLES = ARTICLES.filter(article => {
      const articleTime = moment.tz(article.timestamp, "YYYY-MM-DD HH:mm", TZ);
      return moment().tz(TZ).diff(articleTime) < EXPIRATION;
    });
  
    ARTICLES.sort((a, b) => moment(b.timestamp, "YYYY-MM-DD HH:mm").diff(moment(a.timestamp, "YYYY-MM-DD HH:mm")));
    return ARTICLES;
  } catch (error) {
    console.error("The Sun haber çekme hatası:");
    console.log(`thesun Hata alındı, ${RETRY_DELAY / (60 * 1000)} dakika sonra tekrar denenecek...`);
    setTimeout(scrapeNews, RETRY_DELAY);
    return [];
  }
};


const scrapeNews = async () => {
  try {
    if (firstRun) {
      console.log("thesun İlk haber çekme işlemi başlatılıyor...");
      firstRun = false;
    } else {
      console.log("thesun Haberler güncelleniyor...");
    }
    await getNews();
  } catch (error) {
    console.error("thesun ScrapeNews hatası:");
    console.log(`Hata alındı, ${RETRY_DELAY / (60 * 1000)} dakika sonra tekrar denenecek...`);
    setTimeout(scrapeNews, RETRY_DELAY);
    return;
  }
  setTimeout(scrapeNews, SCRAPE_INTERVAL);
  console.log("thesun Haberler güncellendi.");
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

function getTheSunArticles() {
  return ARTICLES.map(art => ({
    baslik: art.title,
    aciklama: art.description,
    link: art.link,
    resim: art.img,
    timestamp: art.timestamp,
    relative_time: computeRelativeTime(art.timestamp),
    publish_time: art.publish_time,
    source: "thesun.co.uk",
  }));
}

function startTheSunScraper() {
  scrapeNews();
}

module.exports = { startTheSunScraper, getTheSunArticles };
