const axios = require("axios");
const cheerio = require("cheerio");
const moment = require("moment-timezone");

const TZ = "Europe/Istanbul";
const SCRAPE_INTERVAL = 5 * 60 * 1000; // 5 dakika
const EXPIRATION = 12 * 60 * 60 * 1000; // 12 saat
const RETRY_DELAY = 30 * 60 * 1000; // 30 dakika

let ARTICLES = [];
let ARTICLE_LINKS = new Set();
let ARTICLE_TITLES = new Set(); 
let firstRun = true;
const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/65.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/17.17134"
];

const getRandomUserAgent = () => userAgents[Math.floor(Math.random() * userAgents.length)];

const getNews = async () => {
  const url = "https://www.tribunnews.com/";
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1"
      }
    });
    const $ = cheerio.load(response.data);
    let newsItems = [];

    $("li.p1520.art-list.pos_rel").each((index, element) => {
      const newsElem = $(element);
      const imgDiv = newsElem.find("div.fr.mt5.pos_rel");
      if (!imgDiv.hasClass("ml15")) {
        let titleTag = newsElem.find("h3 a[title]");
        if (titleTag.length === 0) {
          titleTag = newsElem.find("a[title]");
        }

        const title = titleTag.attr("title")?.trim() || "No title";
        let link = titleTag.attr("href") || "";
        if (!link.startsWith("https://")) {
          link = `https://www.tribunnews.com/${link}`;
        }

        const uniqueIdentifier = `${title.toLowerCase()}-${link}`;
        if (ARTICLE_LINKS.has(uniqueIdentifier) || ARTICLE_TITLES.has(title.toLowerCase())) return;

        const img = newsElem.find("img").attr("src") || "No image";
        const description = newsElem.find("div.grey2.pt5.f13.ln18.txt-oev-2").text().trim() || "No description";
        const timeTag = newsElem.find("time.foot.timeago");
        let timestamp = moment().tz(TZ).format("YYYY-MM-DD HH:mm");
        let publish_time = moment().tz(TZ).format("HH:mm");

        if (timeTag.attr("title")) {
          let rawTime = timeTag.attr("title");
          let parsedTime = moment.tz(rawTime, TZ).subtract(4, "hours");
          if (moment().tz(TZ).diff(parsedTime, "hours") <= 12) {
            timestamp = parsedTime.format("YYYY-MM-DD HH:mm");
            publish_time = parsedTime.format("HH:mm");
          }
        }

        newsItems.push({ title, link, img, description, timestamp, publish_time, source: "tribunnews.com" });
        ARTICLE_LINKS.add(uniqueIdentifier);
        ARTICLE_TITLES.add(title.toLowerCase());
      }
    });
    ARTICLES = [...newsItems, ...ARTICLES].slice(0, 100);
    ARTICLES = ARTICLES.filter(article => moment().tz(TZ).diff(moment.tz(article.timestamp, "YYYY-MM-DD HH:mm", TZ)) < EXPIRATION);
    ARTICLES.sort((a, b) => moment(b.timestamp, "YYYY-MM-DD HH:mm").diff(moment(a.timestamp, "YYYY-MM-DD HH:mm")));
    return ARTICLES;
  } catch (error) {
    setTimeout(scrapeNews, RETRY_DELAY);
    return [];
  }
};

const scrapeNews = async () => {
  try {
    if (firstRun) {
      console.log("tribunnews İlk haber çekme işlemi başlatılıyor...");
      firstRun = false;
    } else {
      console.log("tribunnews Haberler güncelleniyor...");
    }
    await getNews();
  } catch (error) {
    console.log(`tribunnews Hata alındı, ${RETRY_DELAY / (60 * 1000)} dakika sonra tekrar denenecek...`);
    setTimeout(scrapeNews, RETRY_DELAY);
    return;
  }
  setTimeout(scrapeNews, SCRAPE_INTERVAL);
  console.log("tribunnews Haberler güncellendi.");
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

function getTribunnewsArticles() {
  return ARTICLES.map(art => ({
    baslik: art.title,
    aciklama: art.description,
    link: art.link,
    resim: art.img,
    timestamp: art.timestamp,
    relative_time: art.timestamp ? computeRelativeTime(art.timestamp) : "N/A",
    publish_time: art.publish_time,
    source: "tribunnews.com"
  }));
}

function startTribunnewsScraper() {
  scrapeNews();
}

module.exports = { startTribunnewsScraper, getTribunnewsArticles };
