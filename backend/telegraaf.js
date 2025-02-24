const axios = require('axios');
const cheerio = require('cheerio');
const moment = require('moment-timezone');

const SCRAPE_INTERVAL = 5 * 60 * 1000; // 5 dakika
const RETRY_INTERVAL = 30 * 60 * 1000; // 30 dakika

let ARTICLES = [];
let isFirstRun = true;

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
    console.error(`telegraaf Timestamp alınamadı (${link}): Haber listeden çıkarılıyor.`);
    return null;
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

      if (!publication_time) return null; // Hata alındıysa bu haberi eklemiyoruz.
      return { title, link, img: image, timestamp: publication_time, publish_time: publication_time, source: 'telegraaf.nl' };
    };

    const topTeaser = $('article.TopTeaser').first();
    if (topTeaser.length) {
      const topNews = await processArticle(topTeaser);
      if (topNews) newsItems.push(topNews);
    }

    const basicTeasers = $('article.BasicTeaser').toArray();
    for (let teaser of basicTeasers) {
      const news = await processArticle($(teaser));
      if (news) newsItems.push(news);
    }

    return newsItems;
  } catch (error) {
    console.error("telegraaf Sayfaya erişme hatası: 30 dakika sonra tekrar denenecek...");
    await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
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
    if (isFirstRun) {
      console.log("telegraaf İlk haber çekme işlemi başlatılıyor...");
      isFirstRun = false;
    } else {
      console.log("telegraaf Haberler güncelleniyor...");
    }

  } catch (error) {
    console.error("telegraaf İnternet hatası: 30 dakika sonra tekrar denenecek...");
    await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
  }

  setTimeout(scrapeNews, SCRAPE_INTERVAL);
};

function startTelegraafScraper() {
  scrapeNews();
}

function getTelegraafArticles() {
  return ARTICLES.map(art => ({
    baslik: art.title,
    aciklama: art.description || '',
    link: art.link,
    resim: art.img,
    timestamp: art.timestamp,
    publish_time: art.publish_time,
    source: 'telegraaf.nl'
  }));
}

module.exports = { startTelegraafScraper, getTelegraafArticles };