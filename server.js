import express from 'express';
import cors from 'cors';
import RSSParser from 'rss-parser';
import axios from 'axios';
import Database from 'better-sqlite3';
import https from 'https';

const app = express();
const parser = new RSSParser();
const PORT = 3001;

const agent = new https.Agent({ rejectUnauthorized: false });

// --- DATABASE SETUP ---
const db = new Database('news_archive.db');
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
    fullJson TEXT,
    createdAt INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_articles_pubdate ON articles(pubDateMs);
  CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(sourceId);
`);

const insertStmt = db.prepare(`
  INSERT OR REPLACE INTO articles (link, title, sourceId, sourceName, pubDate, pubDateMs, description, image, fullJson, createdAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// --- CONFIG ---
const GLOBAL_SOURCES = [
  { id: 'svt', url: 'https://www.svt.se/nyheter/rss.xml', weight: 55 },
  { id: 'dn', url: 'https://www.dn.se/rss/nyheter/', weight: 50 },
  { id: 'svd', url: 'https://www.svd.se/?service=rss', weight: 50 },
  { id: 'bbc', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', weight: 55 },
  { id: 'npr', url: 'https://feeds.npr.org/1001/rss.xml', weight: 55 },
  { id: 'ap', url: 'https://newsatme.com/ap-news-rss-feed/', weight: 60 },
  { id: 'nyt', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', weight: 50 },
  { id: 'aljazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', weight: 45 },
  { id: 'tech', url: 'https://techcrunch.com/feed/', weight: 35 },
  { id: 'sc', url: 'https://www.sweclockers.com/feeds/nyheter', weight: 35 },
  { id: 'nasa', url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', weight: 40 },
  { id: 'forsk', url: 'https://www.forskning.se/feed/', weight: 40 },
  { id: 'fz', url: 'https://www.fz.se/feeds/nyheter', weight: 35 },
  { id: 'svtsport', url: 'https://www.svt.se/sport/rss.xml', weight: 45 },
  { id: 'svtkultur', url: 'https://www.svt.se/kultur/rss.xml', weight: 40 },
  { id: 'reddit', url: 'https://www.reddit.com/r/popular/top.json?t=day&limit=15', weight: 15 }
];

const STOP_WORDS = new Set(['och', 'det', 'att', 'i', 'en', 'jag', 'hon', 'han', 'på', 'den', 'med', 'var', 'sig', 'för', 'så', 'till', 'är', 'men', 'ett', 'om', 'hade', 'de', 'av', 'icke', 'mig', 'du', 'henne', 'då', 'sin', 'nu', 'har', 'inte', 'hans', 'honom', 'skulle', 'hennes', 'där', 'min', 'man', 'ej', 'vid', 'kunde', 'något', 'från', 'ut', 'när', 'efter', 'upp', 'vi', 'dem', 'vara', 'vad', 'över', 'än', 'dig', 'kan', 'sina', 'här', 'ha', 'mot', 'alla', 'under', 'någon', 'eller', 'allt', 'mycket', 'sedan', 'ju', 'denna', 'själv', 'detta', 'åt', 'utan', 'varit', 'hur', 'ingen', 'mitt', 'ni', 'bli', 'blev', 'oss', 'din', 'dessa', 'några', 'deras', 'bliver', 'mina', 'samma', 'vilken', 'er', 'sådan', 'vår', 'blivit', 'dess', 'inom', 'mellan', 'sådant', 'varför', 'varje', 'vilka', 'ditt', 'vem', 'vilket', 'sitta', 'sådana', 'vart', 'dina', 'vars', 'vårt', 'våra', 'ert', 'era', 'vilkas', 'just', 'bland', 'även', 'både', 'idag', 'igår', 'säger', 'uppger', 'enligt', 'meddelar', 'skriver', 'finns', 'kommer', 'efter', 'eftersom', 'behöver', 'många', 'fler', 'stora', 'inför', 'redan', 'måste']);

function getKeywords(text) {
  if (!text) return [];
  return text.toLowerCase().replace(/[^\w\s\u00C0-\u00FF]/g, '').split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w));
}

function calculateSimilarity(articleA, articleB) {
  const wordsA = new Set(getKeywords(articleA.title + " " + (articleA.description || "")));
  const wordsB = new Set(getKeywords(articleB.title + " " + (articleB.description || "")));
  const intersection = [...wordsA].filter(x => wordsB.has(x)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
}

function calculateTopHeadlines() {
  const now = Date.now();
  const allArticles = db.prepare("SELECT * FROM articles WHERE pubDateMs > ?").all(now - (24 * 60 * 60 * 1000));
  if (allArticles.length === 0) return [];

  const trendMap = new Map();
  allArticles.forEach(art => {
    const words = [...new Set(getKeywords(art.title))];
    words.forEach(word => trendMap.set(word, (trendMap.get(word) || 0) + 1));
  });

  const scored = allArticles.map(art => {
    let score = 10;
    getKeywords(art.title).forEach(word => score += (trendMap.get(word) || 0) * 15);
    const meta = GLOBAL_SOURCES.find(s => s.id === art.sourceId);
    score += (meta ? meta.weight : 25);
    const ageInHours = (now - art.pubDateMs) / (1000 * 60 * 60);
    const finalScore = score / (1 + (ageInHours / 4));
    return { ...art, rankScore: finalScore };
  });

  const sorted = scored.sort((a, b) => b.rankScore - a.rankScore);
  const distinct = [];
  for (const art of sorted) {
    if (distinct.length >= 10) break;
    const existingIdx = distinct.findIndex(existing => calculateSimilarity(existing, art) > 0.25);
    if (existingIdx === -1) {
      distinct.push({ ...JSON.parse(art.fullJson), rankScore: art.rankScore });
    } else {
      distinct[existingIdx].rankScore += (art.rankScore * 0.4);
    }
  }
  return distinct.sort((a, b) => b.rankScore - a.rankScore);
}

// --- EXPRESS ---
app.use(cors());

app.get('/api/dashboard-init', (req, res) => {
  res.json({ topHeadlines: calculateTopHeadlines(), serverTime: new Date() });
});

app.get('/api/news', (req, res) => {
  const { id } = req.query;
  // Sortera på riktig pubDateMs istället för inmatningstid
  const articles = db.prepare("SELECT * FROM articles WHERE sourceId = ? ORDER BY pubDateMs DESC LIMIT 25").all(id);
  res.json(articles.map(art => ({ ...JSON.parse(art.fullJson), pubDate: art.pubDate })));
});

// --- FETCH SERVICE ---
async function fetchWithRetry(url, id) {
  try {
    const res = await axios.get(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000,
      httpsAgent: agent
    });
    if (id === 'reddit') {
      return res.data.data.children.map(c => {
        const pDate = new Date(c.data.created_utc * 1000).toISOString();
        return {
          title: c.data.title, link: `https://reddit.com${c.data.permalink}`,
          sourceId: 'reddit', sourceName: `REDDIT R/${c.data.subreddit.toUpperCase()}`,
          pubDate: pDate, pubDateMs: new Date(pDate).getTime(),
          description: c.data.selftext, image: null
        };
      });
    }
    const feed = await parser.parseString(res.data);
    return feed.items.map(i => {
      const pDate = i.pubDate || i.isoDate || new Date().toISOString();
      return {
        title: i.title, link: i.link, sourceId: id, sourceName: feed.title?.split(' - ')[0] || id.toUpperCase(),
        pubDate: pDate, pubDateMs: new Date(pDate).getTime(),
        description: (i.contentSnippet || "").replace(/<[^>]*>/g, '').slice(0, 300),
        image: i.enclosure?.url || null
      };
    });
  } catch (e) {
    console.error(`[FETCH ERROR] ${id}: ${e.message}`);
    return [];
  }
}

async function updateAllSources() {
  console.log('[SERVER] Synkroniserar källor...');
  for (const source of GLOBAL_SOURCES) {
    await new Promise(r => setTimeout(r, 500));
    const items = await fetchWithRetry(source.url, source.id);
    items.forEach(i => insertStmt.run(i.link, i.title, i.sourceId, i.sourceName, i.pubDate, i.pubDateMs, i.description, i.image, JSON.stringify(i), Date.now()));
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`>>> Intelligence Engine v8.4 (Perfect Sorting) on port ${PORT}`);
  updateAllSources();
  setInterval(updateAllSources, 15 * 60 * 1000);
});
