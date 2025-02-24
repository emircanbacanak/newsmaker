const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const moment = require("moment-timezone");
const path = require("path");

const app = express();
const PORT = 3000;
let ARTICLES = [];
const TZ = "Europe/Istanbul";

const getNews = async () => {
  const url = "https://www.tribunnews.com/";
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    let newsItems = [];

    $("li.p1520.art-list.pos_rel").each((index, element) => {
      const newsElem = $(element);
      const imgDiv = newsElem.find("div.fr.mt5.pos_rel");
      if (!imgDiv.hasClass("ml15")) {
        let newsData = {};
        let titleTag = newsElem.find("h3 a[title]");
        if (titleTag.length === 0) {
          titleTag = newsElem.find("a[title]");
        }
        newsData.title = titleTag.attr("title")?.trim() || "No title";
        let href = titleTag.attr("href") || "";
        if (!href.startsWith("https://")) {
          href = `https://www.tribunnews.com/${href}`;
        }
        newsData.link = href;
        const imgTag = newsElem.find("img");
        newsData.img = imgTag.attr("src") || "No image";

        const descriptionTag = newsElem.find("div.grey2.pt5.f13.ln18.txt-oev-2");
        newsData.description = descriptionTag.text().trim() || "No description";

        const timeTag = newsElem.find("time.foot.timeago");
        if (timeTag.attr("title")) {
          let rawTime = timeTag.attr("title");
          let timestamp = moment.tz(rawTime, TZ).subtract(4, "hours");
          let currentTime = moment().tz(TZ);
          let timeDiff = moment.duration(currentTime.diff(timestamp));

          if (timeDiff.asHours() <= 12) {
            newsData.timestamp = timestamp.format("YYYY-MM-DD HH:mm");
            newsData.publish_time = timestamp.format("HH:mm");
            newsData.source = "tribunnews.com";
            newsItems.push(newsData);
          }
        }
      }
    });

    // Sadece son 12 saat içinde olan haberleri filtrele
    newsItems = newsItems.filter(item => {
      let timestamp = moment(item.timestamp, "YYYY-MM-DD HH:mm");
      return moment().diff(timestamp, 'hours') <= 12;
    });

    // Haberleri daha yeni tarihler önce olacak şekilde sıralan
    newsItems.sort((a, b) => {
      return moment(b.timestamp).diff(moment(a.timestamp));
    });

    return newsItems;
  } catch (error) {
    console.error("Haber çekme hatası:", error);
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
  } catch (error) {
    console.error("ScrapeNews hatası:", error);
  }
  setTimeout(scrapeNews, 60000);  // Haberleri her 1 dk bir güncelle
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
