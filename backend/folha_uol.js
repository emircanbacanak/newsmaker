const axios = require("axios");
const cheerio = require("cheerio");
const moment = require("moment-timezone");

let ARTICLES = new Map();
const SCRAPE_INTERVAL = 5* 60 * 1000;  // 5 dakika
const EXPIRATION = 12 * 60 * 60 * 1000; // 12 saat
const RETRY_INTERVAL = 30 * 60 * 1000;  // 30 dakika sonra tekrar deneme

const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
};

const turkeyTz = "Europe/Istanbul";
const url = "https://www1.folha.uol.com.br/ultimas-noticias/#15"; 
function getImageUrl(element) {
    let imgUrl = element.find("img").attr("data-src") || element.find("img").attr("src") || "No image";
    if (imgUrl.startsWith("//")) {
        imgUrl = "https:" + imgUrl;
    }
    if (imgUrl.startsWith("data:image")) {
        imgUrl = "";
    }
    return imgUrl;
}

async function getNews() {
    try {
        const response = await axios.get(url, { headers });
        const $ = cheerio.load(response.data);
        const currentTime = moment().tz(turkeyTz);
        let articles = [];

        const firstArticleElement = $("li.c-main-headline").first();
        const firstArticleLink = firstArticleElement.find("a").attr("href");
        const firstArticleTitle = firstArticleElement.find(".c-main-headline__title").text().trim();
        const firstArticleDescription = firstArticleElement.find(".c-main-headline__standfirst").text().trim();
        const firstArticleImageUrl = getImageUrl(firstArticleElement);
        const firstArticleTimestampText = firstArticleElement.find("time").text().trim();
        let firstArticleTimestamp = moment(firstArticleTimestampText, "DD.MMM.YYYY [às] HH[h]mm", "pt-br");
        if (firstArticleTimestamp.isValid()) {
            firstArticleTimestamp = firstArticleTimestamp.add(3, 'hours');
            const timeDiff = currentTime.diff(firstArticleTimestamp, "hours");
            if (timeDiff <= 12) {
                articles.push({ 
                    title: firstArticleTitle, 
                    link: firstArticleLink, 
                    time: firstArticleTimestamp.format("YYYY-MM-DD HH:mm"), 
                    description: firstArticleDescription, 
                    image_url: firstArticleImageUrl 
                });
            }
        }

        $("li.c-headline").each((i, el) => {
            const element = $(el);
            const link = element.find("a").attr("href") || null;
            const title = element.find(".c-headline__title").text().trim() || null;
            const description = element.find(".c-headline__standfirst").text().trim() || null;
            const imageUrl = getImageUrl(element);
            const timestampText = element.find("time").text().trim() || null;
            if (timestampText) {
                let timestamp = moment(timestampText, "DD.MMM.YYYY [às] HH[h]mm", "pt-br");
                if (timestamp.isValid()) {
                    timestamp = timestamp.add(3, 'hours'); 
                    const timeDiff = currentTime.diff(timestamp, "hours");
                    if (timeDiff <= 11) {
                        articles.push({ title, link, time: timestamp.format("YYYY-MM-DD HH:mm"), description, image_url: imageUrl });
                    }
                }
            }
        });
        return articles;
    } catch (err) {
        return [];
    }
}

async function scrapeNews() {
    const newArticles = await getNews();
    const currentTime = moment().tz(turkeyTz);
    let updatedArticles = [...ARTICLES];

    newArticles.forEach((article) => {
        if (!ARTICLES.has(article.link)) {
            ARTICLES.set(article.link, article);
        }
    });
    ARTICLES.forEach((article, key) => {
        const artMoment = moment(article.time, "YYYY-MM-DD HH:mm");
        if (moment().diff(artMoment) >= EXPIRATION) {
            ARTICLES.delete(key);
        }
    });
    ARTICLES = new Map([...ARTICLES.entries()].sort((a, b) => 
        moment(b[1].time, "YYYY-MM-DD HH:mm").diff(moment(a[1].time, "YYYY-MM-DD HH:mm"))
    ));
}

async function startFolhaScraper() {
    console.log("folha İlk haber çekme işlemi başlatılıyor...");
    await scrapeNews();
    setInterval(async () => {
        console.log("folha Haberler güncelleniyor...");
        try {
            await scrapeNews();
        } catch (err) {
            setTimeout(async () => {
                await scrapeNews();
            }, RETRY_INTERVAL);
        }
    }, SCRAPE_INTERVAL);
}

function getFolhaArticles() {
    return Array.from(ARTICLES.values()).map(article => ({
        baslik: article.title,
        aciklama: article.description,
        link: article.link,
        resim: article.image_url,
        timestamp: article.time,
        source: "folha.uol",
    }));
}

module.exports = { startFolhaScraper, getFolhaArticles };
