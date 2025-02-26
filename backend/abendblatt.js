const axios = require("axios");
const cheerio = require("cheerio");
const moment = require("moment");

let ARTICLES = new Set();
const SCRAPE_INTERVAL = 5 * 60 * 1000; // 5 dakika
const EXPIRATION = 12 * 60 * 60 * 1000; // 12 saat
const RETRY_INTERVAL = 30 * 60 * 1000; // 30 dakika

let isFirstRun = true;

async function getTimestampFromLink(link) {
  if (link === "#" || !link.startsWith("http")) {
    return null;
  }
  try {
    const response = await axios.get(link, { timeout: 60000 });
    if (response.status === 404) {
      return null;
    }

    const $ = cheerio.load(response.data);
    const timeElem = $("time");
    if (timeElem.length && timeElem.attr("datetime")) {
      let timeStr = timeElem.attr("datetime");
      return moment(timeStr.replace("Z", "+00:00")).toDate();
    } else {
      return new Date();
    }
  } catch (e) {
    console.error("Abendblatt Hata alınırken, linkin zaman damgası alınamadı:" + link);
    return null;
  }
}

async function scrapeNews() {
  if (isFirstRun) {
    console.log("Abendblatt İlk haber çekme işlemi başlatılıyor...");
    isFirstRun = false;
  } else {
    console.log("Abendblatt Haberler güncelleniyor...");
  }
  const url = "https://www.abendblatt.de/";
  try {
    const response = await axios.get(url, { timeout: 60000 });
    const $ = cheerio.load(response.data);
    let newArticles = [];

    async function extractArticles(container) {
      let articlesArray = [];
      const liElements = container
        .find('li.w-full.block.md\\:flex.lg\\:block.bg-transparent.hover\\:bg-hover-100.focus-within\\:bg-background-300.p-2.relative.transition')
        .toArray();
      for (let li of liElements) {
        const liElem = $(li);
        let title = liElem.find("strong").text().trim();
        let description = liElem.find("p.text-body2").text().trim();
        let link = liElem.find("a.article-teaser-link").attr("href") || "#";
        if (link.startsWith("/")) {
          link = "https://www.abendblatt.de" + link;
        }

        let imageUrl = "https://via.placeholder.com/150";
        let pictureTag = liElem.find("picture");
        if (pictureTag.length) {
          let imgSources = pictureTag.find("source");
          if (imgSources.length) {
            imageUrl = $(imgSources[0]).attr("srcset").split(" ")[0];
          } else {
            let imgElem = pictureTag.find("img").first();
            if (imgElem.length) {
              imageUrl = imgElem.attr("src");
            }
          }
        }

        let timestamp = await getTimestampFromLink(link);
        if (timestamp) {
          articlesArray.push({
            baslik: title,
            aciklama: description,
            link: link,
            resim: imageUrl,
            timestamp: timestamp,
            source: "www.abendblatt.de",
          });
        }
      }
      return articlesArray;
    }

    async function extractHeadlines(section) {
      let articlesArray = [];
      const ulElem = section.find("ul").first();
      if (ulElem.length) {
        const liElems = ulElem.find("li").toArray();
        for (let li of liElems) {
          const liElem = $(li);
          const linkElem = liElem.find("a.article-teaser-link").first();
          let link = linkElem.attr("href") || "#";
          if (link.startsWith("/")) {
            link = "https://www.abendblatt.de" + link;
          }
          let title = linkElem.find("strong").text().trim() || "Başlık bulunamadı";
          let description = linkElem.find("p.text-body2").text().trim() || "Açıklama bulunamadı";
          let imageUrl = "https://via.placeholder.com/150";
          const pictureElem = liElem.find("picture").first();
          if (pictureElem.length) {
            const sourceElem = pictureElem.find("source").first();
            if (sourceElem.length) {
              imageUrl = sourceElem.attr("srcset").split(" ")[0];
            } else {
              const imgElem = pictureElem.find("img").first();
              if (imgElem.length) {
                imageUrl = imgElem.attr("src");
              }
            }
          }
          let timestamp = await getTimestampFromLink(link);
          if (timestamp) {
            articlesArray.push({
              baslik: title,
              aciklama: description,
              link: link,
              resim: imageUrl,
              timestamp: timestamp,
              source: "www.abendblatt.de",
            });
          }
        }
      }
      return articlesArray;
    }

    async function extractHeadline2() {
      let headlineArticle = null;
      const headlineSection = $('div.relative.w-full.bg-background-100.p-2.transition');
      if (headlineSection.length) {
        const linkElem = headlineSection.find("a.article-teaser-link").first();
        let link = linkElem.attr("href") || "#";
        if (link.startsWith("/")) {
          link = "https://www.abendblatt.de" + link;
        }
        let title = linkElem.find("strong").text().trim();
        let description = linkElem.find("p.text-body2").text().trim();
        let imageUrl = null;
        const pictureElem = headlineSection.find("picture").first();
        if (pictureElem.length) {
          const sourceElem = pictureElem.find("source").first();
          if (sourceElem.length) {
            imageUrl = sourceElem.attr("srcset").split(" ")[0];
          } else {
            const imgElem = pictureElem.find("img").first();
            if (imgElem.length) {
              imageUrl = imgElem.attr("src");
            }
          }
        }

        let timestamp = await getTimestampFromLink(link);
        if (timestamp) {
          headlineArticle = {
            baslik: title,
            aciklama: description,
            link: link,
            resim: imageUrl || "https://via.placeholder.com/150",
            timestamp: timestamp,
            source: "www.abendblatt.de",
          };
        }
      }
      return headlineArticle;
    }

    const ulContainers = $('ul.mb-5.grid.grid-cols-1.gap-0.px-2.lg\\:mb-8.lg\\:grid-cols-3.lg\\:gap-5\\.5');
    const articlesPromises = [];
    for (let i = 0; i < ulContainers.length; i++) {
      let container = $(ulContainers[i]);
      articlesPromises.push(extractArticles(container));
    }

    const headlinePromises = [];
    const headlinesSection = $('section[aria-label="Aufmacher"]');
    if (headlinesSection.length) {
      headlinePromises.push(extractHeadlines(headlinesSection));
    }

    const headline2Promise = extractHeadline2();
    const results = await Promise.all([
      ...articlesPromises,
      ...headlinePromises,
      headline2Promise
    ]);

    newArticles = results.flat();
    newArticles.forEach((art) => ARTICLES.add(JSON.stringify(art)));
    cleanupArticles();
  } catch (e) {
    console.error("Abendblatt Haberleri çekerken hata oluştu:", e.message);
    setTimeout(scrapeNews, RETRY_INTERVAL);
  }
}

function cleanupArticles() {
  const now = moment();
  ARTICLES = new Set([...ARTICLES].filter((art) => {
    const article = JSON.parse(art);
    const articleTime = moment(article.timestamp);
    const diff = now.diff(articleTime, 'milliseconds');
    return diff < EXPIRATION;
  }));
}

function startAbendblattScraper() {
  scrapeNews();
  setInterval(scrapeNews, SCRAPE_INTERVAL);
}

function getAbendblattArticles() {
  return [...ARTICLES].map(art => JSON.parse(art));
}
module.exports = { startAbendblattScraper, getAbendblattArticles };