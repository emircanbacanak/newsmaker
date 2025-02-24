const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const moment = require("moment-timezone");
const path = require("path");

const app = express();
const PORT = 3000;
let ARTICLES = [];
const TZ = "Europe/Istanbul";

const fetchArticleTime = async (link) => {
  try {
    const response = await axios.get(link);
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
    console.error("Haber zaman bilgisini çekerken hata oluştu:", link, error);
    return null;
  }
};

const getNews = async () => {
  const url = "https://www.thesun.co.uk/";
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    let newsItems = [];
  
    $(".sun-grid-container.customiser-v2-layout-20-small-single-container .teaser-item").each((index, element) => {
      const item = $(element);
      const title = item.find("a.text-anchor-wrap").attr("data-headline")?.trim() || "No title";
      let link = item.find("a.text-anchor-wrap").attr("href") || "";
      if (link && !link.startsWith("https://")) {
        link = `https://www.thesun.co.uk${link}`;
      }
      const img = item.find("div.teaser__image-container picture img").attr("src") || "No image";
      const description = "";
      const timestamp = moment().tz(TZ).format("YYYY-MM-DD HH:mm");
      const publish_time = moment().tz(TZ).format("HH:mm");
      newsItems.push({
        title,
        link,
        img,
        description,
        timestamp,
        publish_time,
        source: "thesun.co.uk"
      });
    });

    $(".sun-grid-container.customiser-v2-layout-5-large-4-container .teaser-item").each((index, element) => {
      const item = $(element);
      const title = item.find("a.text-anchor-wrap").attr("data-headline")?.trim() || "No title";
      let link = item.find("a.text-anchor-wrap").attr("href") || "";
      if (link && !link.startsWith("https://")) {
        link = `https://www.thesun.co.uk${link}`;
      }
      const img = item.find("div.teaser__image-container picture img").attr("src") || "No image";
      const description = item.find("p.teaser__lead").text().trim() || "";
      const timestamp = moment().tz(TZ).format("YYYY-MM-DD HH:mm");
      const publish_time = moment().tz(TZ).format("HH:mm");
      newsItems.push({
        title,
        link,
        img,
        description,
        timestamp,
        publish_time,
        source: "thesun.co.uk"
      });
    });

    const newsWithTime = await Promise.all(
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

    newsWithTime.sort((a, b) => moment(b.timestamp, "YYYY-MM-DD HH:mm").diff(moment(a.timestamp, "YYYY-MM-DD HH:mm")));
    return newsWithTime;
  } catch (error) {
    console.error("The Sun haber çekme hatası:", error);
    return [];
  }
};

const scrapeNews = async () => {
  try {
    const newArticles = await getNews();
    let newArticlesToAdd = [];
    newArticles.forEach(article => {
      const existingIndex = ARTICLES.findIndex(existing => existing.link === article.link);
      if (existingIndex === -1) {
        newArticlesToAdd.push(article);
      } else {
        ARTICLES[existingIndex] = article;
      }
    });
    if (newArticlesToAdd.length > 0) {
      ARTICLES = [...newArticlesToAdd, ...ARTICLES];
    }
    ARTICLES = ARTICLES.filter(article => {
      const articleTime = moment.tz(article.timestamp, "YYYY-MM-DD HH:mm", TZ);
      return moment().tz(TZ).diff(articleTime) < 12 * 60 * 60 * 1000; // 12 saat = 43,200,000 ms
    });
    ARTICLES.sort((a, b) => {
      const timeA = moment.tz(a.timestamp, "YYYY-MM-DD HH:mm", TZ);
      const timeB = moment.tz(b.timestamp, "YYYY-MM-DD HH:mm", TZ);
      return timeB.diff(timeA);
    });
  } catch (error) {
    console.error("ScrapeNews hatası:", error);
  }
  setTimeout(scrapeNews, 60000);
  console.log("Haberler güncelleniyor...");
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
    const data = JSON.stringify(
      ARTICLES.map(art => ({
        baslik: art.title,
        aciklama: art.description,
        link: art.link,
        resim: art.img,
        timestamp: art.timestamp,
        relative_time: art.timestamp ? computeRelativeTime(art.timestamp) : "N/A",
        publish_time: art.publish_time,
        source: art.source
      }))
    );
    if (data !== lastData) {
      res.write(`data: ${data}\n\n`);
      lastData = data;
    }
  };
  const interval = setInterval(sendData, 5000);
  req.on("close", () => clearInterval(interval));
});

app.listen(PORT, () => {
  console.log(`Server ${PORT} portunda çalışıyor...`);
  scrapeNews();
});