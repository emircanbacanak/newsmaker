const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const moment = require('moment-timezone');

const app = express();
const PORT = 3000;
let ARTICLES = [];

const getHighestResolutionImage = (imgElem) => {
  const srcset = imgElem.attr('srcset') || '';
  if (srcset) {
    const srcsetItems = srcset.split(', ');
    let resolutions = [];
    srcsetItems.forEach(item => {
      const parts = item.split(' ');
      if (parts.length === 2) {
        const url = parts[0];
        const resolutionValue = parseInt(parts[1].replace('w', ''));
        resolutions.push({ url, resolution: resolutionValue });
      }
    });
    if (resolutions.length > 0) {
      return resolutions.reduce((prev, current) => prev.resolution > current.resolution ? prev : current).url;
    }
  }
  return imgElem.attr('src') || '';
};

const getArticleTimestamp = async (link) => {
  try {
    const response = await axios.get(link);
    const $ = cheerio.load(response.data);
    const timeElement = $('time[datetime]').first();
    return timeElement.attr('datetime') || '';
  } catch (error) {
    console.error(`Timestamp alınamadı (${link}):`, error);
    return '';
  }
};

const getNews = async () => {
  const url = "https://www.telegraaf.nl/nieuws/binnenland";
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    let newsItems = [];

    const processArticle = async (articleElem) => {
      const title = articleElem.find('h3').text().trim() || '';
      const linkPath = articleElem.find('a').attr('href') || '';
      const link = "https://www.telegraaf.nl" + linkPath;
      const imageTag = articleElem.find('img').first();
      let image = imageTag.length ? "https://www.telegraaf.nl" + getHighestResolutionImage(imageTag) : '';
      let publication_time = await getArticleTimestamp(link);
      return { title, link, img: image, timestamp: publication_time, publish_time: publication_time, source: 'telegraaf.nl' };
    };

    const topTeaser = $('article.TopTeaser').first();
    if (topTeaser.length) {
      newsItems.push(await processArticle(topTeaser));
    }

    const basicTeasers = $('article.BasicTeaser').toArray();
    for (let teaser of basicTeasers) {
      newsItems.push(await processArticle($(teaser)));
    }

    return newsItems;
  } catch (error) {
    console.error("Haber çekme hatası:", error);
    return [];
  }
};

const scrapeNews = async () => {
  try {
    const newArticles = await getNews();
    let updatedArticles = [];
    
    newArticles.forEach(article => {
      const existingIndex = ARTICLES.findIndex(existing => existing.link === article.link);
      if (existingIndex !== -1) {
        ARTICLES[existingIndex] = { ...ARTICLES[existingIndex], ...article };
      } else {
        updatedArticles.push(article);
      }
    });
    
    ARTICLES = [...updatedArticles, ...ARTICLES];
    
    const twelveHoursAgo = moment().subtract(12, 'hours');
    ARTICLES = ARTICLES.filter(article => moment(article.timestamp).isAfter(twelveHoursAgo));
    
    ARTICLES.sort((a, b) => moment(b.timestamp).diff(moment(a.timestamp)));
  } catch (error) {
    console.error("ScrapeNews hatası:", error);
  }
  setTimeout(scrapeNews, 120000);
  console.log("Tekrar haberler çekiliyor...")
};

app.use(express.static(path.join(__dirname, '../frontend')));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let lastData = JSON.stringify([]);
  const sendData = () => {
    const data = JSON.stringify(
      ARTICLES.map(art => ({
        baslik: art.title,
        aciklama: art.description,
        link: art.link,
        resim: art.img,
        timestamp: art.timestamp,
        publish_time: art.publish_time,
        source: art.source
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
