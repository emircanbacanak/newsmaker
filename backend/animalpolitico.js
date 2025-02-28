const axios = require('axios');
const cheerio = require('cheerio');
const moment = require('moment-timezone');
require('moment/locale/es');
require('moment/locale/tr');
const http = require('http');
const https = require('https');

let ARTICLES = new Map();

const SCRAPE_INTERVAL = 5 * 60 * 1000; 
const EXPIRATION = 12 * 60 * 60 * 1000;
const BASE_URL = "https://www.animalpolitico.com";

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json; charset=UTF-8',
  },
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
});

function getFullUrl(urlPath) {
  if (urlPath && urlPath.startsWith('/')) {
    return BASE_URL + urlPath;
  }
  return urlPath;
}

async function getNews() {
  let newsList = [];
  try {
    const response = await axiosInstance.get(BASE_URL);
    const $ = cheerio.load(response.data);
    const now = moment().tz("America/Mexico_City").startOf('day');
    let seenLinks = new Set();

    $('div.grid.grid-cols-12.gap-4.border-b.border-b-gray-200.pb-4').each((i, container) => {
      const aTag = $(container).find('a').first();
      let link = aTag.attr('href');
      if (!link) return;
      link = getFullUrl(link);
      if (seenLinks.has(link)) return;
      seenLinks.add(link);
      let imgTag = aTag.find('img').first();
      let image = imgTag.attr('src') || '';
      image = image ? getFullUrl(image) : '';
      let title = $(container).find('div.text-3xl.font-Inter-Bold').text().trim();
      if (!title) {
        title = aTag.text().trim();
      }
      let category = $(container).find('div.rounded-full').first().text().trim();
      newsList.push({
        link,
        resim: image,
        baslik: title,
        aciklama: category,
        timestamp: now.format("YYYY-MM-DD"),
        source: "animalpolitico.com",
        saat: "null"
      });
    });

    $('div.grid.md\\:grid-cols-2.gap-4.pt-4.border-b.border-gray-200').each((i, container) => {
      $(container).find('div.mb-4').each((j, articleDiv) => {
        const aTag = $(articleDiv).find('a').first();
        let link = aTag.attr('href');
        if (!link) return;
        link = getFullUrl(link);
        if (seenLinks.has(link)) return;
        seenLinks.add(link);
        let imgTag = $(articleDiv).find('a > div.relative img').first();
        let image = imgTag.attr('src') || '';
        image = image ? getFullUrl(image) : '';
        let title = $(articleDiv).find('div.mb-2').text().trim();
        if (!title) {
          title = $(articleDiv).find('a.font-Inter-Bold').text().trim();
        }
        let category = $(articleDiv).find('div.rounded-full').first().text().trim();
        newsList.push({
          link,
          resim: image,
          baslik: title,
          aciklama: category,
          timestamp: now.format("YYYY-MM-DD"),
          source: "animalpolitico.com",
          saat: "null"
        });
      });
    });

    $('div.grid.md\\:grid-cols-2.xl\\:grid-cols-3.gap-4.pt-4').each((i, container) => {
      $(container).find('div.mb-4').each((j, articleDiv) => {
        const aTag = $(articleDiv).find('div.col-span-5 a').first();
        let link = aTag.attr('href');
        if (!link) return;
        link = getFullUrl(link);
        if (seenLinks.has(link)) return;
        seenLinks.add(link);
        let imgTag = $(articleDiv).find('div.col-span-5 a img').first();
        let image = imgTag.attr('src') || '';
        image = image ? getFullUrl(image) : '';
        let title = $(articleDiv).find('div.mb-2').text().trim();
        if (!title) {
          title = $(articleDiv).find('a.font-Inter-Bold').text().trim();
        }
        let category = $(articleDiv).find('div.rounded-full').first().text().trim();
        newsList.push({
          link,
          resim: image,
          baslik: title,
          aciklama: category,
          timestamp: now.format("YYYY-MM-DD"),
          source: "animalpolitico.com",
          saat: "null"
        });
      });
    });

    $('div.col-span-full.lg\\:col-span-2.border-r-gray-200.border-r').each((i, container) => {
      $(container).find('div.grid.grid-cols-12.gap-4.py-4.border-b-gray-200.border-b').each((j, articleDiv) => {
        const aTag = $(articleDiv).find('div.col-span-5 a').first();
        let link = aTag.attr('href');
        if (!link) return;
        link = getFullUrl(link);
        if (seenLinks.has(link)) return;
        seenLinks.add(link);
        let imgTag = aTag.find('img').first();
        let image = imgTag.attr('src') || '';
        image = image ? getFullUrl(image) : '';
        let title = $(articleDiv).find('div.col-span-7 a.font-Inter-Bold').text().trim();
        if (!title) {
          title = $(articleDiv).find('a').first().text().trim();
        }
        let category = "";
        newsList.push({
          link,
          resim: image,
          baslik: title,
          aciklama: category,
          timestamp: now.format("YYYY-MM-DD"),
          source: "animalpolitico.com",
          saat: "null"
        });
      });
    });

  } catch (err) {
    setTimeout(getNews, 30 * 60 * 1000);
  }
  return newsList;
}

async function scrapeNews() {
  try {
    const newArticles = await getNews();
    const now = moment().tz("America/Mexico_City").startOf('day');
    newArticles.forEach(article => {
      ARTICLES.set(article.link, article);
    });

    ARTICLES.forEach((article, key) => {
      if (now.diff(moment(article.timestamp), 'milliseconds') >= EXPIRATION) {
        ARTICLES.delete(key);
      }
    });
    ARTICLES = new Map([...ARTICLES.entries()].sort((a, b) => 
      moment(b[1].timestamp).diff(moment(a[1].timestamp))
    ));

  } catch (err) {
    setTimeout(scrapeNews, 30 * 60 * 1000);
  }
}

let isFirstRun = true;

function backgroundTask() {
  if (isFirstRun) {
    isFirstRun = false;
    console.log('animalpolitico İlk haber çekme işlemi başlatılıyor...');
  } else {
    console.log('animalpolitico Haberler güncelleniyor...');
  }
  scrapeNews();
  setInterval(async () => {
    await scrapeNews(); 
  }, SCRAPE_INTERVAL);
}

function getAnimalpoliticoArticles() {
  return Array.from(ARTICLES.values()).map(art => ({
    baslik: art.baslik,
    aciklama: art.aciklama,
    link: art.link,
    resim: art.resim,
    timestamp: moment(art.timestamp).format("DD MMMM YYYY"), 
    source: art.source,
    saat: "null"
  }));
}

function startAnimalpoliticoScraper() {
  backgroundTask();
}

module.exports = { startAnimalpoliticoScraper, getAnimalpoliticoArticles };
