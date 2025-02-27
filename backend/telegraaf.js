const axios = require('axios');
const cheerio = require('cheerio');
const moment = require('moment-timezone');

const SCRAPE_INTERVAL = 12 * 60 * 1000; // 5 dakika
const RETRY_INTERVAL = 30 * 60 * 1000; // 30 dakika
const EXPIRATION = 12 * 60 * 60 * 1000; // 12 saat

let ARTICLES = new Set();
let isFirstRun = true;

const getHighestResolutionImage = (imgElem) => {
  const srcset = imgElem.attr('srcset') || '';
  if (srcset) {
    const resolutions = srcset.split(', ').map(item => {
      const parts = item.split(' ');
      return { url: parts[0], resolution: parseInt(parts[1]?.replace('w', '') || 0) };
    }).filter(item => item.resolution);
    if (resolutions.length) {
      return resolutions.reduce((prev, current) => (prev.resolution > current.resolution ? prev : current)).url;
    }
  }
  return imgElem.attr('src') || '';
};

const getArticleTimestamp = async (link) => {
  try {
    const response = await axios.get(link);
    const $ = cheerio.load(response.data);
    return $('time[datetime]').first().attr('datetime') || '';
  } catch (error) {
    return null;
  }
};

const getNews = async () => {
  const url = "https://www.telegraaf.nl/nieuws/binnenland";
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const newsItems = new Set();
    const processArticle = async (articleElem) => {
      const title = articleElem.find('h3').text().trim() || '';
      const linkPath = articleElem.find('a').attr('href') || '';
      if (!title || !linkPath) return null;
      const link = "https://www.telegraaf.nl" + linkPath;
      const imageTag = articleElem.find('img').first();
      const image = imageTag.length ? "https://www.telegraaf.nl" + getHighestResolutionImage(imageTag) : '';
      const publication_time = await getArticleTimestamp(link);
      if (!publication_time) return null;
      return { title, link, img: image, timestamp: publication_time, publish_time: publication_time, source: 'telegraaf.nl' };
    };

    const topTeaser = $('article.TopTeaser').first();
    if (topTeaser.length) {
      const topNews = await processArticle(topTeaser);
      if (topNews) newsItems.add(JSON.stringify(topNews));
    }

    const basicTeasers = $('article.BasicTeaser').toArray();
    for (let teaser of basicTeasers) {
      const news = await processArticle($(teaser));
      if (news) newsItems.add(JSON.stringify(news));
    }
    return Array.from(newsItems).map(item => JSON.parse(item));
  } catch (error) {
    console.error("telegraaf Sayfaya erişme hatası: 30 dakika sonra tekrar denenecek...");
    await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
    return [];
  }
};

const scrapeNews = async () => {
  try {
    const newArticles = await getNews();
    const updatedArticles = new Set([...ARTICLES]);
    newArticles.forEach(article => updatedArticles.add(JSON.stringify(article)));
    const twelveHoursAgo = moment().subtract(EXPIRATION, 'hours');
    ARTICLES = new Set([...updatedArticles].map(item => JSON.parse(item)).filter(article =>
      moment(article.timestamp).isAfter(twelveHoursAgo)
    ).map(item => JSON.stringify(item)));

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
  return Array.from(ARTICLES).map(item => {
    const art = JSON.parse(item);
    return {
      baslik: art.title,
      aciklama: art.description || '',
      link: art.link,
      resim: art.img,
      timestamp: art.timestamp,
      publish_time: art.publish_time,
      source: 'telegraaf.nl'
    };
  });
}

module.exports = { startTelegraafScraper, getTelegraafArticles };
