const axios = require("axios");
const cheerio = require("cheerio");
let ARTICLES = [];

const SCRAPE_INTERVAL = 10 * 60 * 1000;
const EXPIRATION = 12 * 60 * 60 * 1000; // 12 saat
const RETRY_INTERVAL = 30 * 60 * 1000;  // 30 dakika

const fetchArticleTime = async (link) => {
  try {
    const response = await axios.get(link, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      timeout: 15000,
    });
    
    const $ = cheerio.load(response.data);
    const pubTimeText = $("span.pub_time").text().trim();
    

    if (pubTimeText) {
      const updatedMatch = pubTimeText.match(/Updated:\s*([\w\s\d,]+ \d{1,2}:\d{2} [APM]+)?/);
      const publishedMatch = pubTimeText.match(/Published:\s*([\w\s\d,]+ \d{1,2}:\d{2} [APM]+)?/);
      const timeString = updatedMatch ? updatedMatch[1] : (publishedMatch ? publishedMatch[1] : null);

      if (timeString) {
        let articleDate = new Date(timeString);
        articleDate.setHours(articleDate.getHours() - 5);
        return articleDate.toISOString();
      }
    }
    return null;
  } catch (error) {
    console.error("Global Times Error fetching article time:");
    return null;
  }
};

const getNews = async () => {
  const url = "https://www.globaltimes.cn/";
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });
    const $ = cheerio.load(response.data);
    let newsItems = [];
    const fallbackTime = new Date().toISOString();

    $(".new_form03, .new_form01, .new_form02, .new_form04, .new_form05, .new_form06").each(
      (index, element) => {
        const item = $(element);
        const title =
          item
            .find("a.new_title_m, a.new_title_s, a.new_title_ml")
            .text()
            .trim() || "No title";
        let link = item
          .find("a.new_title_m, a.new_title_s, a.new_title_ml")
          .attr("href") || "";
        if (link && !link.startsWith("https://")) {
          link = `https://www.globaltimes.cn${link}`;
        }
        const img = item.find("img").attr("src") || "";
        const description = item.find("p").text().trim() || "";
        newsItems.push({
          title,
          link,
          img,
          description,
          timestamp: fallbackTime,
          publish_time: fallbackTime,
          source: "globaltimes.cn",
        });
      }
    );

    $(".section02_col01 .modal02_new_form01, .section02_col01 .modal02_new_form02, .section02_col01 .modal03_new_form01, .section02_col01 .modal03_new_form02, .section02_col01 .modal03_new_form03").each(
      (index, element) => {
        const item = $(element);
        const title =
          item.find("a.new_title_s, a.new_title_ms").text().trim() || "No title";
        let link = item.find("a.new_title_s, a.new_title_ms").attr("href") || "";
        if (link && !link.startsWith("https://")) {
          link = `https://www.globaltimes.cn${link}`;
        }
        const img = item.find("img").attr("src") || "";
        const description = item.find("p").text().trim() || "";
        newsItems.push({
          title,
          link,
          img,
          description,
          timestamp: fallbackTime,
          publish_time: fallbackTime,
          source: "globaltimes.cn",
        });
      }
    );

    $(".visual_news_content li").each((index, element) => {
      const item = $(element);
      const title = item.find("a.new_title_s").text().trim() || "No title";
      let link = item.find("a.new_title_s").attr("href") || "";
      if (link && !link.startsWith("https://")) {
        link = `https://www.globaltimes.cn${link}`;
      }
      const img = item.find("img").attr("src") || "";
      const description = item.find("p.from_column").text().trim() || "";
      newsItems.push({
        title,
        link,
        img,
        description,
        timestamp: fallbackTime,
        publish_time: fallbackTime,
        source: "globaltimes.cn",
      });
    });

    $("ul li.bimg_new_form").each((index, element) => {
      const item = $(element);
      const title = item.find("a.new_title_m").text().trim() || "No title";
      let link = item.find("a.new_title_m").attr("href") || "";
      if (link && !link.startsWith("https://")) {
        link = `https://www.globaltimes.cn${link}`;
      }
      const img = item.find("a").first().find("img").attr("src") || "";
      const description = item.find("p").first().text().trim() || "";
      newsItems.push({
        title,
        link,
        img,
        description,
        timestamp: fallbackTime,
        publish_time: fallbackTime,
        source: "globaltimes.cn",
      });
    });

    $("ul li.simg_new_form").each((index, element) => {
      const item = $(element);
      item.find("a.new_title_s").each((i, el) => {
        const aTag = $(el);
        const title = aTag.text().trim() || "No title";
        let link = aTag.attr("href") || "";
        if (link && !link.startsWith("https://")) {
          link = `https://www.globaltimes.cn${link}`;
        }
        let img = aTag.prev("a").find("img").attr("src") || "";
        const description = "";
        newsItems.push({
          title,
          link,
          img,
          description,
          timestamp: fallbackTime,
          publish_time: fallbackTime,
          source: "globaltimes.cn",
        });
      });
    });

    $("ul li.noimg_new_form").each((index, element) => {
      const item = $(element);
      item.find("a.new_title_s").each((i, el) => {
        const aTag = $(el);
        const title = aTag.text().trim() || "No title";
        let link = aTag.attr("href") || "";
        if (link && !link.startsWith("https://")) {
          link = `https://www.globaltimes.cn${link}`;
        }
        const description = aTag.next("p").text().trim() || "";
        const img = "";
        newsItems.push({
          title,
          link,
          img,
          description,
          timestamp: fallbackTime,
          publish_time: fallbackTime,
          source: "globaltimes.cn",
        });
      });
    });

    const newsWithTime = await Promise.all(
      newsItems.map(async (article) => {
        if (article.link && article.link.includes("globaltimes.cn")) {
          const articleTime = await fetchArticleTime(article.link);
          if (articleTime) {
            article.timestamp = articleTime;
            article.publish_time = articleTime;
            return article;
          } else {
            return null;
          }
        }
        return article;
      })
    );
    const filteredNews = newsWithTime.filter(article => article !== null);
    filteredNews.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return filteredNews;
  } catch (error) {
    console.error("Global Times haber çekme hatası:");
    setTimeout(() => getNews(), RETRY_INTERVAL);
    return [];
  }
};

const scrapeNews = async () => {
  try {
    const newArticles = await getNews();
    let newArticlesToAdd = [];

    newArticles.forEach((article) => {
      const existingIndex = ARTICLES.findIndex(
        (existing) => existing.link === article.link && existing.title === article.title
      );

      if (existingIndex === -1) {
        newArticlesToAdd.push(article);
      } else {
        ARTICLES[existingIndex].timestamp = article.timestamp;
      }
    });
    if (newArticlesToAdd.length > 0) {
      ARTICLES = [...newArticlesToAdd, ...ARTICLES];
    }
    ARTICLES = ARTICLES.filter((article) => {
      const articleTime = new Date(article.timestamp);
      return new Date().getTime() - articleTime.getTime() < EXPIRATION;
    });
    const seenArticles = new Set();
    ARTICLES = ARTICLES.filter((article) => {
      const key = article.link + article.title;
      if (seenArticles.has(key)) {
        return false;
      } else {
        seenArticles.add(key);
        return true;
      }
    });
    ARTICLES.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch (error) {
    console.error("Global Times ScrapeNews hatası:");
    setTimeout(() => scrapeNews(), RETRY_INTERVAL);
  }
};

function startGlobalTimesScraper() {
  console.log("Global Times İlk haber çekme işlemi başlatılıyor...");
  scrapeNews();
  setInterval(() => {
    console.log("Global Times Haberler güncelleniyor...");
    scrapeNews();
  }, SCRAPE_INTERVAL);
}

function getGlobalTimesArticles() {
  return ARTICLES.map(article => ({
    baslik: article.title,
    aciklama: article.description,
    link: article.link,
    resim: article.img,
    timestamp: article.timestamp,
    publish_time: article.publish_time,
    source: article.source
  }));
}

module.exports = { startGlobalTimesScraper, getGlobalTimesArticles };