const axios = require('axios'); 
const cheerio = require('cheerio');
const moment = require('moment-timezone');

const RETRY_INTERVAL = 30 * 60 * 1000; // 30 dakika
const SCRAPE_INTERVAL = 5* 60 * 1000; // 5 dakika
const EXPIRATION = 12 * 60 * 60 * 1000; // 12 saat

let ARTICLES = [];

const url = "https://www.lefigaro.fr/";
const turkeyTz = "Europe/Istanbul";

const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:85.0) Gecko/20100101 Firefox/85.0",
];

function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

function getBestImageFromSrcset(srcset) {
    let bestUrl = null;
    let bestWidth = 0;
    srcset.split(',').forEach(item => {
        const parts = item.trim().split(' ');
        if (parts.length >= 2) {
            const urlCandidate = parts[0].trim();
            const widthStr = parts[1].trim();
            if (widthStr.endsWith('w')) {
                const width = parseInt(widthStr.slice(0, -1));
                if (width > bestWidth) {
                    bestWidth = width;
                    bestUrl = urlCandidate;
                }
            }
        }
    });
    return bestUrl;
}

async function fetchPublishTimeFromArticleParallel(articleUrl) {
    try {
        const response = await axios.get(articleUrl, { headers });
        if (response.status !== 200) {
            throw new Error(`Sayfaya erişilemedi: lefigaro`);
        }
        const $ = cheerio.load(response.data);
        const publishTimeTag = $(".fig-content-metas__pub-date time");
        const updateTimeTag = $(".fig-content-metas__pub-maj-date time");

        let publishTime = publishTimeTag.attr("datetime") || null;
        let updateTime = updateTimeTag.attr("datetime") || null;
        let publishMoment = publishTime ? moment.tz(publishTime, "YYYY-MM-DDTHH:mm:ssZ", "Europe/Paris") : null;
        let updateMoment = updateTime ? moment.tz(updateTime, "YYYY-MM-DDTHH:mm:ssZ", "Europe/Paris") : null;
        
        let turkeyPublishTime = publishMoment ? publishMoment.clone().tz(turkeyTz) : null;
        let turkeyUpdateTime = updateMoment ? updateMoment.clone().tz(turkeyTz) : null;
        let finalTime = turkeyPublishTime;
        if (turkeyUpdateTime && turkeyUpdateTime.isAfter(turkeyPublishTime)) {
            finalTime = turkeyUpdateTime;
        }

        const currentTime = moment().tz(turkeyTz);
        if (finalTime && currentTime.diff(finalTime, 'hours') <= EXPIRATION) {
            return finalTime.format("DD MMMM YYYY HH:mm");
        } else {
            return null;
        }
    } catch (err) {
        return null;
    }
}

const cookies = "cookie_name=value; another_cookie=another_value";
const headers = {
    "User-Agent": getRandomUserAgent(),
    "Cookie": cookies, 
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": url, 
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "TE": "trailers"
};

async function fetchNews(url) {
    try {
        const response = await axios.get(url, { headers });
        if (response.status !== 200) {
            throw new Error(`lefigaro Sayfaya erişme hatası`);
        }
        const $ = cheerio.load(response.data);
        const articles = [];
        $("article").each((i, element) => {
            const article = $(element);
            const title = article.find("h1, h2, h3").text().trim() || "Başlık bulunamadı";
            const description = article.find("p").text().trim() || "";
            const linkElem = article.find("a[href]");
            let link = "";
            if (linkElem.length > 0) {
                link = linkElem.attr("href");
                if (!link.startsWith("https://")) {
                    link = "https://www.lefigaro.fr" + link;
                }
            }
            if (!description || !link.startsWith("https://")) {
                return;
            }
            let image = "";
            const imageTag = article.find("img");
            if (imageTag) {
                const srcset = imageTag.attr("srcset") || imageTag.attr("data-srcset");
                if (srcset) {
                    image = getBestImageFromSrcset(srcset);
                }
            }
            articles.push({
                title: title,
                description: description,
                link: link,
                image: image || "Görsel bulunamadı",
                source: "lefigaro.fr"
            });
        });
        const articlesWithTime = await Promise.all(articles.map(async (article) => {
            const publish_time = await fetchPublishTimeFromArticleParallel(article.link);
            if (publish_time) {
                return { ...article, publish_time };
            } else {
                return null;
            }
        }));
        return articlesWithTime.filter(article => article !== null);
    } catch (err) {
        console.log(`lefigaro Hata`);
        throw err;
    }
}

async function scrapeNews() {
    let isFirstRun = true;
    const uniqueArticlesSet = new Set();

    while (true) {
        try {
            const newArticles = await fetchNews(url);
            const currentTime = moment().tz(turkeyTz);
            const validNewArticles = newArticles.filter(article => {
                const publishTime = moment(article.publish_time, "DD MMMM YYYY HH:mm");
                return currentTime.diff(publishTime, 'hours') <= EXPIRATION;
            });
            validNewArticles.forEach(article => {
                if (!uniqueArticlesSet.has(article.link)) {
                    uniqueArticlesSet.add(article.link);
                }
            });
            ARTICLES = Array.from(uniqueArticlesSet).map(link => {
                return validNewArticles.find(article => article.link === link);
            });
            ARTICLES.sort((a, b) => {
                const timeA = moment(a.publish_time, "DD MMMM YYYY HH:mm");
                const timeB = moment(b.publish_time, "DD MMMM YYYY HH:mm");
                return timeB - timeA;
            });

            if (isFirstRun) {
                console.log("lefigaro İlk haber çekme işlemi başlatılıyor...");
                isFirstRun = false;
            } else {
                console.log("lefigaro Haberler güncelleniyor...");
            }
        } catch (err) {
            console.log("lefigaro Bir hata oluştu, 30 dakika sonra tekrar denenecek...");
            await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
            continue;
        }
        await new Promise(resolve => setTimeout(resolve, SCRAPE_INTERVAL));
    }
}
const startlefigaroNews = async () => {
    await scrapeNews();
};

const getlefigaroArticles = () => {
    return ARTICLES.filter(article => article && article.title)
    .map(article => ({
        baslik: article.title,
        aciklama: article.description,
        link: article.link,
        resim: article.image,
        timestamp: article.publish_time,
        source: "lefigaro.fr",
    }));
};

module.exports = { startlefigaroNews, getlefigaroArticles };
