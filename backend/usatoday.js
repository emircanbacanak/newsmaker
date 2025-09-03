const axios = require("axios");
const cheerio = require("cheerio");
const moment = require("moment-timezone");

// Moment.js locale ayarı
moment.locale('en');

let ARTICLES = new Set(); 
const SCRAPE_INTERVAL = 5 * 60 * 1000; // 5 dakika
const EXPIRATION = 12 * 60 * 60 * 1000; // 12 saat
const BASE_URL = "https://www.usatoday.com";
const NEWS_URLS = [
    "https://www.usatoday.com/", // Ana sayfa
    "https://www.usatoday.com/news/nation/" // Haberler bölümü
];
const TZ = "Europe/Istanbul";

function convertEtToTurkey(dateStr) {
    try {
        if (!dateStr || dateStr.trim() === '') {
            return moment().tz(TZ);
        }
        
        // ET (Eastern Time) kısaltmasını kaldır ve fazladan boşlukları temizle
        dateStr = dateStr.replace("ET", "")
                         .replace(/\./g, "")
                         .replace(/,/g, "")
                         .replace(/\s+/g, " ") // Çoklu boşlukları tek boşluğa çevir
                         .trim()
                         .toUpperCase();
        
        // Ay isimlerini moment.js formatına çevir (tam ay isimleri)
        dateStr = dateStr.replace(/JAN\b/g, "January")
                         .replace(/FEB\b/g, "February")
                         .replace(/MAR\b/g, "March")
                         .replace(/APR\b/g, "April")
                         .replace(/MAY\b/g, "May")
                         .replace(/JUN\b/g, "June")
                         .replace(/JUL\b/g, "July")
                         .replace(/AUG\b/g, "August")
                         .replace(/SEPT\b/g, "September")  // SEPT'i September'a çevir
                         .replace(/SEP\b/g, "September")
                         .replace(/OCT\b/g, "October")
                         .replace(/NOV\b/g, "November")
                         .replace(/DEC\b/g, "December");
        
        let currentYear = moment().year();
        if (!/\d{4}$/.test(dateStr)) {
            dateStr = `${dateStr} ${currentYear}`;
        }
        
        // Eastern Time'dan parse et - farklı formatları dene
        let dtEastern;
        
        // Format 1: "h:mm A MMMM D YYYY" (saat ile) - "7:50 AM September 2 2025"
        dtEastern = moment.tz(dateStr, "h:mm A MMMM D YYYY", "America/New_York");
        
        // Format 2: "h:mm A MMMM D" (saat ile, yıl yok) - "7:50 AM September 2"
        if (!dtEastern.isValid()) {
            dtEastern = moment.tz(`${dateStr} ${currentYear}`, "h:mm A MMMM D YYYY", "America/New_York");
        }
        
        // Format 3: "MMMM D YYYY" (sadece tarih) - "September 2 2025"
        if (!dtEastern.isValid()) {
            dtEastern = moment.tz(dateStr, "MMMM D YYYY", "America/New_York");
            // Sadece tarih varsa, günün başlangıcını kullan (00:00)
            if (dtEastern.isValid()) {
                dtEastern = dtEastern.startOf('day');
            }
        }
        
        // Format 4: "MMMM D" (sadece ay ve gün) - "August 31"
        if (!dtEastern.isValid()) {
            dtEastern = moment.tz(`${dateStr} ${currentYear}`, "MMMM D YYYY", "America/New_York");
            if (dtEastern.isValid()) {
                dtEastern = dtEastern.startOf('day');
            }
        }
        
        // Format 5: "h:mm A MMMM D YYYY" (strict mode) - "7:50 AM September 2 2025"
        if (!dtEastern.isValid()) {
            dtEastern = moment.tz(dateStr, "h:mm A MMMM D YYYY", "America/New_York", true);
        }
        
        // Format 6: "MMMM D YYYY" (strict mode) - "September 2 2025"
        if (!dtEastern.isValid()) {
            dtEastern = moment.tz(dateStr, "MMMM D YYYY", "America/New_York", true);
            if (dtEastern.isValid()) {
                dtEastern = dtEastern.startOf('day');
            }
        }
        
        if (!dtEastern.isValid()) {
            console.log(`USA Today geçersiz tarih formatı: ${dateStr}`);
            return moment().tz(TZ);
        }
        
        // Türkiye saatine çevir (otomatik yaz/kış saati)
        let dtTurkey = dtEastern.tz(TZ);
        
        // Debug bilgisi (sadece hata durumunda)
        // console.log(`USA Today zaman dönüşümü: ${dateStr} (ET) → ${dtTurkey.format("YYYY-MM-DD HH:mm")} (TR)`);
        
        return dtTurkey;
    } catch (err) {
        console.log(`USA Today zaman dönüşüm hatası: ${err.message} - Orijinal: ${dateStr}`);
        return moment().tz(TZ);
    }
}

function getFullImageUrl(imagePath) {
    if (!imagePath) return '';
    if (imagePath.startsWith('/')) {
        return BASE_URL + imagePath;
    }
    return imagePath;
}

function getImageUrlToJPG(imagePath) {
    if (!imagePath) return '';
    const jpgIndex = imagePath.indexOf('.jpg');
    return jpgIndex !== -1 ? imagePath.substring(0, jpgIndex + 4) : imagePath;
}

async function getNews() {
    let newsList = [];
    
    // Her iki URL'den de haber çek
    for (const newsUrl of NEWS_URLS) {
        try {
            console.log(`USA Today haberleri çekiliyor: ${newsUrl}`);
            const response = await axios.get(newsUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.6943.60 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Connection": "keep-alive",
                },
                timeout: 30000,
                maxRedirects: 5,
            });
            const $ = cheerio.load(response.data);
            const now = moment().tz(TZ);
            const twelveHoursAgo = now.clone().subtract(12, 'hours');

        // Ana sayfa hero haberleri (büyük haberler)
        $('a.gnt_m_he').each((i, item) => {
            const href = $(item).attr('href');
            if (!href) return;
            
            const link = href.startsWith('http') ? href : BASE_URL + href;
            const imgSrc = BASE_URL + ($(item).find('img').attr('src') || '');
            const title = $(item).find('span[data-tb-title]').text().trim() || 
                         $(item).find('span').text().trim() || 
                         $(item).text().trim();
            
            if (!title || title.length < 10) return; // Çok kısa başlıkları atla
            
            const dateInfo = $(item).find('div.gnt_ar_dt').attr('aria-label');
            let timeStr = "";
            if (dateInfo && dateInfo.includes("Updated:")) {
                const match = dateInfo.match(/Updated:\s*([^P]+)/);
                if (match && match[1]) {
                    timeStr = match[1].trim();
                }
            }
            if (!timeStr) {
                const dateElem = $(item).find('div[data-c-dt]');
                timeStr = dateElem.attr('data-c-dt') || "";
            }
            let dtTurkey = timeStr ? convertEtToTurkey(timeStr) : moment().tz(TZ);
            if (dtTurkey && dtTurkey.isAfter(twelveHoursAgo)) {
                const article = {
                    link,
                    resim: imgSrc,
                    baslik: title,
                    aciklama: "",
                    timestamp: dtTurkey.format("YYYY-MM-DD HH:mm"),
                    originalTimestamp: dtTurkey,
                    source: "usatoday.com"
                };
                ARTICLES.add(JSON.stringify(article));  
                newsList.push(article);
            }
        });

        // Ana sayfa tile haberleri (küçük haberler)
        $('a.gnt_m_tl').each((i, item) => {
            const href = $(item).attr('href');
            if (!href) return;
            
            const link = href.startsWith('http') ? href : BASE_URL + href;
            const imgSrc = BASE_URL + ($(item).find('img').attr('src') || '');
            const title = $(item).find('div[data-tb-title]').text().trim() || 
                         $(item).find('div.gnt_m_tl_c').text().trim() ||
                         $(item).text().trim();
            
            if (!title || title.length < 10) return; // Çok kısa başlıkları atla
            
            const dateInfo = $(item).find('div.gnt_ar_dt').attr('aria-label');
            let timeStr = "";
            if (dateInfo && dateInfo.includes("Updated:")) {
                const match = dateInfo.match(/Updated:\s*([^P]+)/);
                if (match && match[1]) {
                    timeStr = match[1].trim();
                }
            }
            if (!timeStr) {
                const dateElem = $(item).find('div[data-c-dt]');
                timeStr = dateElem.attr('data-c-dt') || "";
            }
            let dtTurkey = timeStr ? convertEtToTurkey(timeStr) : moment().tz(TZ);
            if (dtTurkey && dtTurkey.isAfter(twelveHoursAgo)) {
                const article = {
                    link,
                    resim: imgSrc,
                    baslik: title,
                    aciklama: "",
                    timestamp: dtTurkey.format("YYYY-MM-DD HH:mm"),
                    originalTimestamp: dtTurkey,
                    source: "usatoday.com"
                };
                ARTICLES.add(JSON.stringify(article));  
                newsList.push(article);
            }
        });

        // Ana sayfa list item haberleri (yeni yapı)
        $('a.gnt_m_tli').each((i, item) => {
            const href = $(item).attr('href');
            if (!href) return;
            
            const link = href.startsWith('http') ? href : BASE_URL + href;
            const imgSrc = $(item).find('img').attr('src') || $(item).find('img').attr('data-src') || '';
            const fullImgSrc = imgSrc.startsWith('http') ? imgSrc : BASE_URL + imgSrc;
            const title = $(item).find('div[data-tb-title]').text().trim() || 
                         $(item).find('div.gnt_m_tli_c').text().trim() ||
                         $(item).text().trim();
            
            if (!title || title.length < 10) return; // Çok kısa başlıkları atla
            
            const dateInfo = $(item).find('div.gnt_ar_dt').attr('aria-label');
            let timeStr = "";
            if (dateInfo && dateInfo.includes("Updated:")) {
                const match = dateInfo.match(/Updated:\s*([^P]+)/);
                if (match && match[1]) {
                    timeStr = match[1].trim();
                }
            }
            if (!timeStr) {
                const dateElem = $(item).find('div[data-c-dt]');
                timeStr = dateElem.attr('data-c-dt') || "";
            }
            let dtTurkey = timeStr ? convertEtToTurkey(timeStr) : moment().tz(TZ);
            if (dtTurkey && dtTurkey.isAfter(twelveHoursAgo)) {
                const article = {
                    link,
                    resim: fullImgSrc,
                    baslik: title,
                    aciklama: "",
                    timestamp: dtTurkey.format("YYYY-MM-DD HH:mm"),
                    originalTimestamp: dtTurkey,
                    source: "usatoday.com"
                };
                ARTICLES.add(JSON.stringify(article));  
                newsList.push(article);
            }
        });

        $('a.gnt_m_flm_a').each((i, item) => {
            const link = BASE_URL + $(item).attr('href');
            const imgSrc = getFullImageUrl(
                $(item).find('img').attr('src') || $(item).find('img').attr('data-gl-src')
            );
            const imgSrcToJPG = getImageUrlToJPG(imgSrc);
            const title = $(item).text().trim();
            const description = $(item).attr('data-c-br') || '';
            const dateInfo = $(item).find('div.gnt_ar_dt').attr('aria-label');
            let timeStr = "";
            if (dateInfo && dateInfo.includes("Updated:")) {
                const match = dateInfo.match(/Updated:\s*([^P]+)/);
                if (match && match[1]) {
                    timeStr = match[1].trim();
                }
            }
            if (!timeStr) {
                const pubDateStr = $(item).find('div[data-c-dt]').attr('data-c-dt');
                timeStr = pubDateStr || "";
            }
            const dtTurkey = timeStr ? convertEtToTurkey(timeStr) : moment().tz(TZ);
            const timestamp = dtTurkey ? dtTurkey.format("YYYY-MM-DD HH:mm") : "Tarih bulunamadı";
            if (title) {
                const article = {
                    link,
                    resim: imgSrcToJPG,
                    baslik: title,
                    aciklama: description,
                    timestamp,
                    originalTimestamp: dtTurkey,
                    source: "usatoday.com"
                };
                ARTICLES.add(JSON.stringify(article));
                newsList.push(article); 
            }
        });
        } catch (err) {
            console.log(`USA Today bağlantı hatası (${newsUrl}): ${err.code || err.message}`);
        }
    }
    return newsList;
}

async function scrapeNews() {
    try {
        const newArticles = await getNews();
        const now = moment().tz(TZ);
        ARTICLES = new Set([...ARTICLES].filter(articleStr => {
            const article = JSON.parse(articleStr);
            return now.diff(moment(article.originalTimestamp)) < EXPIRATION;
        }));
        ARTICLES = new Set([...ARTICLES].sort((a, b) => {
            const articleA = JSON.parse(a);
            const articleB = JSON.parse(b);
            return moment(articleB.originalTimestamp).diff(moment(articleA.originalTimestamp));
        }));
    } catch (err) {
    }
}

function cleanupArticles() {
    const now = moment().tz(TZ);
    ARTICLES = new Set([...ARTICLES].filter(articleStr => {
        const article = JSON.parse(articleStr);
        return now.diff(moment(article.originalTimestamp)) < EXPIRATION;
    }));
}

function backgroundTask() {
    console.log('usatoday İlk haber çekme işlemi başlatılıyor...');
    scrapeNews();
    setInterval(() => {
        console.log('usatoday Haberler güncelleniyor...');
        scrapeNews();
        cleanupArticles();
    }, SCRAPE_INTERVAL);
}

function getUSATodayArticles() {
    return [...ARTICLES].map(articleStr => {
        const article = JSON.parse(articleStr);
        return {
            baslik: article.baslik,
            aciklama: article.aciklama,
            link: article.link,
            resim: article.resim,
            timestamp: article.timestamp,
            source: article.source
        };
    });
}

function startUSATodayScraper() {
    backgroundTask();
}

module.exports = {
    startUSATodayScraper,
    getUSATodayArticles
};
