const puppeteer = require('puppeteer');
const axios = require('axios'); 
const moment = require('moment-timezone');

let ARTICLES = [];
const BASE_URL = "https://news.naver.com/";

const SCRAPE_INTERVAL = 5 * 60 * 1000;
const RETRY_INTERVAL = 30 * 60 * 1000;
let isFirstRun = true; 

const getNews = async () => {
  const url = BASE_URL;
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0' });

    const newsItems = await page.evaluate(() => {
      let items = [];
      const newsElements = document.querySelectorAll('.comp_news_feed');
      newsElements.forEach(elem => {
        const title = elem.querySelector('.cnf_news_title') ? elem.querySelector('.cnf_news_title').innerText : '';
        const link = elem.querySelector('.cnf_news_area') ? elem.querySelector('.cnf_news_area').href : '';
        const image = elem.querySelector('.cnf_news_thumb img') ? elem.querySelector('.cnf_news_thumb img').src : '';
        const time = elem.querySelector('.cnf_journal_sub') ? elem.querySelector('.cnf_journal_sub').innerText : '';
        
        if (title && link && image && time) {
          items.push({ title, link, img: image, time });
        }
      });
      return items;
    });
    await browser.close();
    return newsItems;
  } catch (error) {
    console.error("news.naver Haber çekme hatası:");
    throw error;
  }
};

const verifyArticles = async () => {
  const validArticles = [];
  for (const article of ARTICLES) {
    try {
      await axios.get(article.link, { timeout: 15000 });
      validArticles.push(article);
    } catch (err) {
    }
  }
  ARTICLES = validArticles;
};

const startNaverNews = async () => {
  if (isFirstRun) {
    console.log("news.naver İlk haber çekme işlemi başlatılıyor...");
  } else {
    console.log("news.naver Haberler güncelleniyor...");
  }
  try {
    const newArticles = await getNews();
    const currentYear = moment().year();
    newArticles.forEach(article => {
      const timeString = `${currentYear} ${article.time}`;
      const articleTimeSeoul = moment.tz(timeString, 'YYYY MM[월] DD[일] HH:mm', 'Asia/Seoul');
      const articleTimeTurkey = articleTimeSeoul.clone().tz('Europe/Istanbul');
      article.timestamp = articleTimeTurkey.toISOString();
      article.publish_time = articleTimeTurkey.format('YYYY-MM-DD HH:mm');
    });

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

    await verifyArticles();
  } catch (error) {
    console.log("Hata durumunda 30 dakika sonra tekrar denenecek...");
    return setTimeout(startNaverNews, RETRY_INTERVAL);
  }
  isFirstRun = false;
  setTimeout(startNaverNews, SCRAPE_INTERVAL);
};

const getNaverArticles = () => {
  return ARTICLES.map(art => ({
    baslik: art.title,
    aciklama: art.description || '',
    link: art.link,
    resim: art.img,
    timestamp: art.timestamp,
    publish_time: art.publish_time,
    source: "news.naver"
  }));
};

module.exports = { startNaverNews, getNaverArticles };
