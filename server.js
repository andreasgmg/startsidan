import express from 'express';
import cors from 'cors';
import RSSParser from 'rss-parser';
import axios from 'axios';
import Database from 'better-sqlite3';
import https from 'https';

const app = express();
const parser = new RSSParser({
  customFields: {
    item: [
      ['media:content', 'mediaContent', {keepArray: false}],
      ['enclosure', 'enclosure', {keepArray: false}]
    ]
  }
});
const PORT = 3001;

const agent = new https.Agent({ rejectUnauthorized: false });

// --- DATABASE SETUP ---
const db = new Database('news_hot.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS articles (
    link TEXT PRIMARY KEY,
    title TEXT,
    sourceId TEXT,
    sourceName TEXT,
    pubDate TEXT,
    pubDateMs INTEGER,
    description TEXT,
    image TEXT,
    sentiment INTEGER,
    fullJson TEXT,
    createdAt INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_pubDate ON articles(pubDateMs);
  CREATE INDEX IF NOT EXISTS idx_source ON articles(sourceId);
`);

const archiveDb = new Database('news_archive.db');
archiveDb.exec(`
  CREATE TABLE IF NOT EXISTS articles (
    link TEXT PRIMARY KEY,
    title TEXT,
    sourceId TEXT,
    pubDateMs INTEGER,
    fullJson TEXT,
    sentiment INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_archive_search ON articles(title);
  CREATE INDEX IF NOT EXISTS idx_archive_date ON articles(pubDateMs);
`);

const insertHot = db.prepare(`
  INSERT OR REPLACE INTO articles (link, title, sourceId, sourceName, pubDate, pubDateMs, description, image, sentiment, fullJson, createdAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertArchive = archiveDb.prepare(`
  INSERT OR IGNORE INTO articles (link, title, sourceId, pubDateMs, fullJson, sentiment)
  VALUES (?, ?, ?, ?, ?, ?)
`);

// --- AVANCERAD SR P4 MAPPING ---
const SR_CHANNELS = {
  'stockholm': 103, 'göteborg': 104, 'malmö': 101, 'uppland': 221, 'väst': 125,
  'sjuhärad': 219, 'skaraborg': 220, 'halland': 128, 'blekinge': 105, 'kristianstad': 102,
  'kronoberg': 211, 'kalmar': 214, 'gotland': 215, 'östergötland': 204, 'sörmland': 217,
  'örebro': 205, 'västmanland': 206, 'värmland': 222, 'dalarna': 223, 'gävleborg': 210,
  'jämtland': 200, 'västernorrland': 207, 'västerbotten': 208, 'norbotten': 209
};

const MUNICIPALITY_TO_STATION = {
  'strömstad': 'väst', 'uddevalla': 'väst', 'lysekil': 'väst', 'munkedal': 'väst', 'tanum': 'väst',
  'trollhättan': 'väst', 'vänersborg': 'väst', 'borås': 'sjuhärad', 'skövde': 'skaraborg',
  'visby': 'gotland'
};

const COUNTY_TO_STATION = {
  'stockholm': 'stockholm', 'västra götaland': 'göteborg', 'skåne': 'malmö',
  'uppsala': 'uppland', 'södermanland': 'sörmland', 'östergötland': 'östergötland',
  'jönköping': 'jönköping', 'kronoberg': 'kronoberg', 'kalmar': 'kalmar',
  'gotland': 'gotland', 'blekinge': 'blekinge', 'halland': 'halland',
  'värmland': 'värmland', 'örebro': 'örebro', 'västmanland': 'västmanland',
  'dalarna': 'dalarna', 'gävleborg': 'gävleborg', 'västernorrland': 'västernorrland',
  'jämtland': 'jämtland', 'västerbotten': 'västerbotten', 'norrbotten': 'norbotten'
};

// --- CONFIG & STOPWORDS ---
const GLOBAL_SOURCES = [
  { id: 'kris', name: 'Krisinformation', url: 'https://api.krisinformation.se/v3/news?days=3', category: 'Viktigt', weight: 100 },
  { id: 'svt', name: 'SVT Nyheter', url: 'https://www.svt.se/nyheter/rss.xml', category: 'Sverige', weight: 55 },
  { id: 'omni', name: 'Omni', url: 'https://omni.se/rss/nyheter', category: 'Sverige', weight: 50 },
  { id: 'dn', name: 'Dagens Nyheter', url: 'https://www.dn.se/rss/nyheter/', category: 'Sverige', weight: 50 },
  { id: 'bbc', name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'Världen', weight: 55 },
  { id: 'npr', name: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml', category: 'Världen', weight: 55 },
  { id: 'ap', name: 'Assoc. Press', url: 'https://newsatme.com/ap-news-rss-feed/', category: 'Världen', weight: 60 },
  { id: 'hn', name: 'Hacker News', url: 'https://hnrss.org/best', category: 'Teknik', weight: 60 },
  { id: 'tech', name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'Teknik', weight: 35 },
  { id: 'sc', name: 'SweClockers', url: 'https://www.sweclockers.com/feeds/nyheter', category: 'Teknik', weight: 35 },
  { id: 'nasa', name: 'NASA', url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', category: 'Vetenskap', weight: 40 },
  { id: 'forsk', name: 'Forskning.se', url: 'https://www.forskning.se/feed/', category: 'Vetenskap', weight: 40 },
  { id: 'fz', name: 'FZ.se', url: 'https://www.fz.se/feeds/nyheter', category: 'Spel', weight: 35 },
  { id: 'svtsport', name: 'SVT Sport', url: 'https://www.svt.se/sport/rss.xml', category: 'Sport', weight: 45 },
  { id: 'svtkultur', name: 'SVT Kultur', url: 'https://www.svt.se/kultur/rss.xml', category: 'Livsstil', weight: 40 },
  { id: 'reddit', name: 'Reddit Popular', url: 'https://www.reddit.com/r/popular/top.json?t=day&limit=15', category: 'Reddit', weight: 15 }
];

const STOP_WORDS = new Set(['och', 'det', 'att', 'i', 'en', 'jag', 'hon', 'han', 'på', 'den', 'med', 'var', 'sig', 'för', 'så', 'till', 'är', 'men', 'ett', 'om', 'hade', 'de', 'av', 'icke', 'mig', 'du', 'henne', 'då', 'sin', 'nu', 'har', 'inte', 'hans', 'honom', 'skulle', 'hennes', 'där', 'min', 'man', 'ej', 'vid', 'kunde', 'något', 'från', 'ut', 'när', 'efter', 'upp', 'vi', 'dem', 'vara', 'vad', 'över', 'än', 'dig', 'kan', 'sina', 'här', 'ha', 'mot', 'alla', 'under', 'någon', 'eller', 'allt', 'mycket', 'sedan', 'ju', 'denna', 'själv', 'detta', 'åt', 'utan', 'varit', 'hur', 'ingen', 'mitt', 'ni', 'bli', 'blev', 'oss', 'din', 'dessa', 'några', 'deras', 'bliver', 'mina', 'samma', 'vilken', 'er', 'sådan', 'vår', 'blivit', 'dess', 'inom', 'mellan', 'sådant', 'varför', 'varje', 'vilka', 'ditt', 'vem', 'vilket', 'sitta', 'sådana', 'vart', 'dina', 'vars', 'vårt', 'våra', 'ert', 'era', 'vilkas', 'just', 'bland', 'även', 'både', 'idag', 'igår', 'säger', 'uppger', 'enligt', 'meddelar', 'skriver', 'finns', 'kommer', 'behöver', 'många', 'fler', 'stora', 'inför', 'redan', 'måste', 'får', 'mer', 'vill', 'varit', 'blir', 'ska', 'skall', 'skulle', 'kunna', 'finns', 'fanns', 'fått', 'får', 'få', 'gå', 'gick', 'gått', 'gör', 'gjorde', 'gjort', 'tar', 'tog', 'tagit', 'ser', 'såg', 'sett', 'sitt', 'sina', 'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us', 'is', 'are', 'was', 'were', 'has', 'had', 'been', 'says', 'said', 'reported', 'according', 'breaking', 'live', 'update', 'video', 'news', 'more', 'top', 'best', 'review', 'analysis', 'watch', 'found', 'during', 'since', 'while']);

const POSITIVE_WORDS = new Set(['succé', 'vinner', 'rekord', 'fred', 'glädje', 'hopp', 'framgång', 'vinst', 'genombrott', 'räddad', 'fynd', 'jubel', 'guld', 'hjälte', 'hyllas', 'kärlek', 'lycka', 'lösning', 'stark', 'stabil', 'växer', 'rekordhög', 'vackert', 'bäst', 'triumf', 'seger', 'löser', 'positiv', 'positivt']);
const NEGATIVE_WORDS = new Set(['död', 'krig', 'kris', 'rasar', 'chock', 'larm', 'skjuten', 'olycka', 'brand', 'hat', 'hot', 'faller', 'sämsta', 'katastrof', 'misslyckande', 'sorg', 'skandal', 'mord', 'våld', 'dödsskjutning', 'rån', 'terror', 'bomb', 'explosion', 'kollaps', 'stopp', 'bråk', 'svält', 'farligt', 'oro', 'ångest', 'varsel', 'konkurs']);

function calculateSentiment(title, description) {
  const text = (title + " " + (description || "")).toLowerCase();
  const words = text.replace(/[^\w\s\u00C0-\u00FF]/g, '').split(/\s+/);
  let score = 0;
  words.forEach(w => {
    if (POSITIVE_WORDS.has(w)) score++;
    if (NEGATIVE_WORDS.has(w)) score--;
  });
  return score > 0 ? 1 : (score < 0 ? -1 : 0);
}

function getKeywords(text) {
  if (!text) return [];
  return text.toLowerCase().replace(/[^\w\s\u00C0-\u00FF]/g, '').replace(/\d+/g, '').split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w));
}

function calculateSimilarity(articleA, articleB) {
  const wordsA = new Set(getKeywords(articleA.title));
  const wordsB = new Set(getKeywords(articleB.title));
  const intersection = [...wordsA].filter(x => wordsB.has(x)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
}

function calculateTopHeadlines() {
  const now = Date.now();
  const dayAgo = now - (24 * 60 * 60 * 1000);
  const twoHoursAgo = now - (2 * 60 * 60 * 1000);
  const allArticles = db.prepare("SELECT * FROM articles WHERE pubDateMs > ?").all(dayAgo);
  if (allArticles.length === 0) return { articles: [], trends: [] };

  const trendMap = new Map();
  const velocityMap = new Map();

  allArticles.forEach(art => {
    const words = getKeywords(art.title);
    const isVeryRecent = art.pubDateMs > twoHoursAgo;
    words.forEach(word => {
      trendMap.set(word, (trendMap.get(word) || 0) + 1);
      if (isVeryRecent) velocityMap.set(word, (velocityMap.get(word) || 0) + 1);
    });
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = words[i] + ' ' + words[i+1];
      trendMap.set(bigram, (trendMap.get(bigram) || 0) + 1.2);
      if (isVeryRecent) velocityMap.set(bigram, (velocityMap.get(bigram) || 0) + 1.2);
    }
  });

  const scored = allArticles.map(art => {
    let score = 10;
    const words = getKeywords(art.title);
    words.forEach(word => {
      score += (trendMap.get(word) || 0) * 15;
      const velocity = velocityMap.get(word) || 0;
      if (velocity > 1.5) score += (velocity * 40); 
    });
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = words[i] + ' ' + words[i+1];
      score += (trendMap.get(bigram) || 0) * 25;
      const velBigram = velocityMap.get(bigram) || 0;
      if (velBigram > 1) score += (velBigram * 60);
    }
    const meta = GLOBAL_SOURCES.find(s => s.id === art.sourceId);
    score += (meta ? meta.weight : 25);
    const ageInHours = (now - art.pubDateMs) / (1000 * 60 * 60);
    return { ...art, rankScore: score / (1 + (ageInHours / 4)) };
  });

  const sorted = scored.sort((a, b) => b.rankScore - a.rankScore);
  const distinct = [];
  for (const art of sorted) {
    if (distinct.length >= 10) break;
    const existingIdx = distinct.findIndex(existing => calculateSimilarity(existing, art) > 0.25);
    if (existingIdx === -1) {
      distinct.push({ ...JSON.parse(art.fullJson), rankScore: art.rankScore, sentiment: art.sentiment });
    } else {
      distinct[existingIdx].rankScore += (art.rankScore * 0.5);
    }
  }

  const allTrends = [...trendMap.entries()].sort((a, b) => {
    const aIsBigram = a[0].includes(' ');
    const bIsBigram = b[0].includes(' ');
    if (aIsBigram && !bIsBigram && a[1] * 1.5 >= b[1]) return -1;
    if (bIsBigram && !aIsBigram && b[1] * 1.5 >= a[1]) return 1;
    return b[1] - a[1];
  });

  const finalTrends = [];
  const usedWords = new Set();
  for (const [term, count] of allTrends) {
    if (finalTrends.length >= 10) break;
    if (count < 1.5 && trendMap.size > 20) continue;
    const parts = term.split(' ');
    if (parts.every(p => !usedWords.has(p))) {
      finalTrends.push(term);
      parts.forEach(p => usedWords.add(p));
    }
  }

  return { articles: distinct.sort((a, b) => b.rankScore - a.rankScore), trends: finalTrends };
}

// --- API ---
app.use(cors());

app.get('/api/config/sources', (req, res) => {
  res.json(GLOBAL_SOURCES.map(s => ({ id: s.id, name: s.name, category: s.category, weight: s.weight })));
});

app.get('/api/dashboard-init', (req, res) => {
  const result = calculateTopHeadlines();
  res.json({ topHeadlines: result.articles, trends: result.trends });
});

app.get('/api/search', (req, res) => {
  let q = req.query.q;
  if (!q) return res.json([]);
  q = q.replace(/[%_]/g, '');
  const hotHits = db.prepare(`SELECT fullJson, pubDateMs, sentiment, sourceId FROM articles WHERE title LIKE ? OR description LIKE ? ORDER BY pubDateMs DESC LIMIT 50`).all(`%${q}%`, `%${q}%`);
  let archiveHits = [];
  if (hotHits.length < 50) {
    archiveHits = archiveDb.prepare(`SELECT fullJson, pubDateMs, sentiment, sourceId FROM articles WHERE title LIKE ? ORDER BY pubDateMs DESC LIMIT 50`).all(`%${q}%`);
  }
  const combined = [...hotHits, ...archiveHits];
  const distinctHits = [];
  for (const hit of combined) {
    const parsed = JSON.parse(hit.fullJson);
    if (!distinctHits.some(e => e.sourceId === hit.sourceId && calculateSimilarity(e, parsed) > 0.4)) {
      distinctHits.push({ ...parsed, pubDateMs: hit.pubDateMs, sentiment: hit.sentiment });
    }
  }
  res.json(distinctHits.sort((a, b) => b.pubDateMs - a.pubDateMs).slice(0, 50));
});

app.get('/api/feed', (req, res) => {
  const sources = req.query.sources ? req.query.sources.split(',') : [];
  if (sources.length === 0) return res.json([]);
  const placeholders = sources.map(() => '?').join(',');
  const articles = db.prepare(`SELECT fullJson, pubDateMs, sentiment FROM articles WHERE sourceId IN (${placeholders}) ORDER BY pubDateMs DESC LIMIT 200`).all(sources);
  res.json(articles.map(art => ({ ...JSON.parse(art.fullJson), pubDateMs: art.pubDateMs, sentiment: art.sentiment })));
});

app.get('/api/config/local-source', async (req, res) => {
  const muni = (req.query.municipality || '').toLowerCase();
  const county = (req.query.county || '').toLowerCase();
  let stationKey = MUNICIPALITY_TO_STATION[muni] || COUNTY_TO_STATION[county];
  const channelId = SR_CHANNELS[stationKey];
  if (!channelId) return res.status(404).json({ error: 'Station not found' });
  const source = {
    id: `sr-p4-${stationKey}`,
    name: `SR P4 ${stationKey.charAt(0).toUpperCase() + stationKey.slice(1)}`,
    url: `https://api.sr.se/api/rss/channel/${channelId}`,
    category: 'Lokalt',
    weight: 70
  };
  const items = await fetchWithRetry(source.url, source.id);
  items.forEach(i => insertHot.run(i.link, i.title, i.sourceId, source.name, i.pubDate, i.pubDateMs, i.description, i.image, i.sentiment, JSON.stringify(i), Date.now()));
  res.json(source);
});

// --- FETCH SERVICE ---
async function fetchWithRetry(url, id) {
  try {
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 StartsidanPro/11.0' }, timeout: 15000, httpsAgent: agent });
    if (id === 'reddit') {
      return res.data.data.children.map(c => {
        const pDate = new Date(c.data.created_utc * 1000).toISOString();
        return {
          title: c.data.title, link: `https://reddit.com${c.data.permalink}`,
          sourceId: 'reddit', sourceName: `REDDIT R/${c.data.subreddit.toUpperCase()}`,
          pubDate: pDate, pubDateMs: new Date(pDate).getTime(),
          description: c.data.selftext, image: null, sentiment: calculateSentiment(c.data.title, c.data.selftext)
        };
      });
    }
    if (id === 'kris') {
      return res.data.map(item => {
        const pDate = item.Published;
        return {
          title: "⚠️ " + item.PushMessage, link: `https://krisinformation.se/nyheter/${item.Id}`,
          sourceId: 'kris', sourceName: 'KRISINFORMATION',
          pubDate: pDate, pubDateMs: new Date(pDate).getTime(),
          description: item.BodyText || item.PushMessage, image: null, sentiment: calculateSentiment(item.PushMessage, item.BodyText)
        };
      });
    }
    const feed = await parser.parseString(res.data);
    return feed.items.map(i => {
      const pDate = i.pubDate || i.isoDate || new Date().toISOString();
      const img = i.enclosure?.url || i.mediaContent?.$.url || i.content?.match(/src="([^"]+)"/)?.[1] || null;
      const desc = (i.contentSnippet || "").replace(/<[^>]*>/g, '').slice(0, 300);
      return {
        title: i.title, link: i.link, sourceId: id, sourceName: feed.title?.split(' - ')[0] || id.toUpperCase(),
        pubDate: pDate, pubDateMs: new Date(pDate).getTime(),
        description: desc, image: img, sentiment: calculateSentiment(i.title, desc)
      };
    });
  } catch (e) { return []; }
}

async function updateAllSources() {
  console.log('[SERVER] Synkar källor...');
  const chunks = [];
  for (let i = 0; i < GLOBAL_SOURCES.length; i += 3) chunks.push(GLOBAL_SOURCES.slice(i, i + 3));
  for (const chunk of chunks) {
    await Promise.all(chunk.map(async (source) => {
      const items = await fetchWithRetry(source.url, source.id);
      items.forEach(i => insertHot.run(i.link, i.title, i.sourceId, i.sourceName, i.pubDate, i.pubDateMs, i.description, i.image, i.sentiment, JSON.stringify(i), Date.now()));
    }));
    await new Promise(r => setTimeout(r, 300));
  }
  const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const oldArticles = db.prepare("SELECT * FROM articles WHERE pubDateMs < ?").all(cutoff);
  if (oldArticles.length > 0) {
    const moveTransaction = archiveDb.transaction((articles) => {
      for (const art of articles) insertArchive.run(art.link, art.title, art.sourceId, art.pubDateMs, art.fullJson, art.sentiment);
    });
    moveTransaction(oldArticles);
    db.prepare("DELETE FROM articles WHERE pubDateMs < ?").run(cutoff);
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`>>> Intelligence Engine v11.4 (Archive Edition) on port ${PORT}`);
  db.exec("VACUUM");
  archiveDb.exec("VACUUM");
  updateAllSources();
  setInterval(updateAllSources, 15 * 60 * 1000);
});