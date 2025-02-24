const axios = require("axios");
const cheerio = require("cheerio");
const moment = require("moment-timezone");

let ARTICLES = [];
const SCRAPE_INTERVAL = 2 * 60 * 1000; // 2 minutes
const RETRY_INTERVAL = 30 * 60 * 1000; // 30 minutes

const TZ_TURKEY = "Europe/Istanbul";
const TZ_JAPAN = "Asia/Tokyo";

const getArticleTime = async (articleUrl) => {
  try {
    const response = await axios.get(articleUrl);
    const $ = cheerio.load(response.data);
    const dateTag = $("p.postdate").text().trim();

    if (dateTag) {
      const dateMatch = dateTag.match(/(\d{1,2}:\d{2}) JST,\s*([A-Za-z]+ \d{1,2}, \d{4})/);
      if (dateMatch) {
        const timePart = dateMatch[1];
        const datePart = dateMatch[2];
        const fullDateTime = moment.tz(`${datePart} ${timePart}`, "MMMM D, YYYY HH:mm", TZ_JAPAN)
          .tz(TZ_TURKEY)
          .format("YYYY-MM-DD HH:mm");
        return fullDateTime;
      }
    }
    return moment().tz(TZ_TURKEY).format("YYYY-MM-DD HH:mm");
  } catch (error) {
    console.error("JapanNews Haber zamanı çekme hatası:");
    return moment().tz(TZ_TURKEY).format("YYYY-MM-DD HH:mm");
  }
};

const getJapanNews = async () => {
  let page = 1;
  let allNews = [];
  const twelveHoursAgo = moment().tz(TZ_TURKEY).subtract(12, "hours");

  while (true) {
    const url = `https://japannews.yomiuri.co.jp/latestnews/page/${page}/`;

    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);
      let newsItems = [];

      $("li.clearfix").each((index, element) => {
        const newsElem = $(element);
        let newsData = {};
        const titleTag = newsElem.find("a div h2");
        newsData.title = titleTag.text().trim() || "No title";
        newsData.link = newsElem.find("a").attr("href") || "";

        if (!newsData.link.startsWith("https://")) {
          newsData.link = `https://japannews.yomiuri.co.jp${newsData.link}`;
        }

        const imgTag = newsElem.find("figure img");
        newsData.img = imgTag.attr("src") || "";
        newsData.author = "No author";

        if (newsData.img) {
          newsItems.push(newsData);
        }
      });

      const timestamps = await Promise.all(newsItems.map((news) => getArticleTime(news.link)));
      newsItems.forEach((news, index) => {
        news.timestamp = timestamps[index];
      });

      for (let news of newsItems) {
        const articleTime = moment(news.timestamp, "YYYY-MM-DD HH:mm").tz(TZ_TURKEY);
        if (articleTime.isBefore(twelveHoursAgo)) {
          return allNews;
        }
        allNews.push(news);
      }
      page++;
    } catch (error) {
      break;
    }
  }
  return allNews;
};

const scrapeNews = async () => {
  try {
    const newArticles = await getJapanNews();
    let newArticlesToAdd = [];

    newArticles.forEach((article) => {
      const existingIndex = ARTICLES.findIndex((existing) => existing.link === article.link);
      if (existingIndex !== -1) {
        ARTICLES[existingIndex] = article; 
      } else {
        newArticlesToAdd.push(article); 
      }
    });

    if (newArticlesToAdd.length > 0) {
      ARTICLES = [...newArticlesToAdd, ...ARTICLES];
    }
  } catch (error) {
    console.error("JapanNews ScrapeNews hatası:", error.message);
    setTimeout(scrapeNews, RETRY_INTERVAL);
  }
};

const startJapanNews = async () => {
  console.log("JapanNews İlk haber çekme işlemi başlatılıyor");
  try {
    await scrapeNews();
    setInterval(async () => {
      console.log("JapanNews haberleri güncelleniyor...");
      await scrapeNews();
    }, SCRAPE_INTERVAL);
  } catch (error) {
    setTimeout(startJapanNews, RETRY_INTERVAL); 
  }
};

const getJapanNewsArticles = () => {
  return ARTICLES.map(article => ({
    baslik: article.title,
    aciklama: article.description,
    link: article.link,
    resim: article.img,
    timestamp: article.timestamp,
    source: "JapanNews.com",
  }));
};

module.exports = { startJapanNews, getJapanNewsArticles };
