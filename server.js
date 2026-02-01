import express from 'express';
import cors from 'cors';
import RSSParser from 'rss-parser';
import axios from 'axios';
import Database from 'better-sqlite3';

const app = express();
const parser = new RSSParser({
  timeout: 10000,
  headers: { 'User-Agent': 'StartsidanPro/6.0' }
});
const PORT = 3001;

// --- DATABASE SETUP ---
const db = new Database('news_archive.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS articles (
    link TEXT PRIMARY KEY,
    title TEXT,
    sourceId TEXT,
    pubDate TEXT,
    description TEXT,
    image TEXT,
    fullJson TEXT,
    createdAt INTEGER
  )
`);

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO articles (link, title, sourceId, pubDate, description, image, fullJson, createdAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

// --- RANKING & ANALYTICS ENGINE ---

const SWEDISH_STOP_WORDS = new Set([
  'och', 'det', 'att', 'i', 'en', 'jag', 'hon', 'han', 'på', 'den', 'med', 'var', 'sig', 'för', 
  'så', 'till', 'är', 'men', 'ett', 'om', 'hade', 'de', 'av', 'icke', 'mig', 'du', 'henne', 
  'då', 'sin', 'nu', 'har', 'inte', 'hans', 'honom', 'skulle', 'hennes', 'där', 'min', 'man', 
  'ej', 'vid', 'kunde', 'något', 'från', 'ut', 'när', 'efter', 'upp', 'vi', 'dem', 'vara', 
  'vad', 'över', 'än', 'dig', 'kan', 'sina', 'här', 'ha', 'mot', 'alla', 'under', 'någon', 
  'eller', 'allt', 'mycket', 'sedan', 'ju', 'denna', 'själv', 'detta', 'åt', 'utan', 'varit', 
  'hur', 'ingen', 'mitt', 'ni', 'bli', 'blev', 'oss', 'din', 'dessa', 'några', 'deras', 'bliver', 
  'mina', 'samma', 'vilken', 'er', 'sådan', 'vår', 'blivit', 'dess', 'inom', 'mellan', 'sådant', 
  'varför', 'varje', 'vilka', 'ditt', 'vem', 'vilket', 'sitta', 'sådana', 'vart', 'dina', 'vars', 
  'vårt', 'våra', 'ert', 'era', 'vilkas', 'just', 'bland', 'även', 'både', 'idag', 'igår'
]);

function getKeywords(text) {
  if (!text) return [];
  const cleanText = text.toLowerCase().replace(/[^\w\s\u00C0-\u00FF]/g, '');
  return cleanText.split(/\s+/).filter(word => 
    word.length > 3 && !SWEDISH_STOP_WORDS.has(word)
  );
}

function calculateSimilarity(articleA, articleB) {
  const wordsA = new Set(getKeywords(articleA.title + " " + (articleA.description || "")));
  const wordsB = new Set(getKeywords(articleB.title + " " + (articleB.description || "")));
  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function calculateTopHeadlines() {
  const now = Date.now();
  const dayAgo = now - (24 * 60 * 60 * 1000);
  const allArticles = db.prepare("SELECT * FROM articles WHERE createdAt > ?").all(dayAgo);
  if (allArticles.length === 0) return [];

  const trendMap = new Map();
  const recentThreshold = now - (6 * 60 * 60 * 1000);
  allArticles.forEach(art => {
    if (art.createdAt > recentThreshold) {
      const words = [...new Set(getKeywords(art.title))];
      words.forEach(word => trendMap.set(word, (trendMap.get(word) || 0) + 1));
    }
  });

  const scored = allArticles.map(art => {
    let score = 10;
    const ageInHours = (now - new Date(art.pubDate).getTime()) / (1000 * 60 * 60);
    getKeywords(art.title).forEach(word => {
      const freq = trendMap.get(word) || 0;
      if (freq > 1) score += (freq * 20);
    });
    const sourceWeights = { 'svt': 50, 'dn': 40, 'reuters': 45, 'bbc': 45, 'reddit': 10 };
    score += (sourceWeights[art.sourceId] || 20);
    const finalScore = score / Math.pow(ageInHours + 1, 1.5);
    return { ...art, rankScore: finalScore };
  });

  const sorted = scored.sort((a, b) => b.rankScore - a.rankScore);
  const distinctArticles = [];
  for (const art of sorted) {
    const isDuplicate = distinctArticles.some(existing => calculateSimilarity(existing, art) > 0.3);
    if (!isDuplicate) {
      const parsed = JSON.parse(art.fullJson);
      distinctArticles.push({ ...parsed, rankScore: art.rankScore });
    }
    if (distinctArticles.length >= 10) break;
  }
  return distinctArticles;
}

// --- NEWS FETCHING SERVICE ---
const newsSources = [
  { id: 'svt', url: 'https://www.svt.se/nyheter/rss.xml' },
  { id: 'dn', url: 'https://www.dn.se/rss/nyheter/' },
  { id: 'svd', url: 'https://www.svd.se/?service=rss' },
  { id: 'bbc', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { id: 'reuters', url: 'https://www.reuters.com/world/rss' },
  { id: 'reddit', url: 'https://www.reddit.com/r/popular/top.json?t=day&limit=15' }
];

async function updateAllSources() {
  console.log('[SERVER] Bakgrundshämtning startad...');
  for (const source of newsSources) {
    try {
      let items = [];
      if (source.id === 'reddit') {
        const response = await axios.get(source.url, { headers: { 'User-Agent': 'StartsidanPro/6.0' } });
        items = response.data.data.children.map(child => ({
          title: child.data.title, link: `https://reddit.com${child.data.permalink}`,
          source: `REDDIT R/${child.data.subreddit.toUpperCase()}`, sourceId: 'reddit',
          pubDate: new Date(child.data.created_utc * 1000).toISOString(), description: child.data.selftext
        }));
      } else {
        const feed = await parser.parseURL(source.url);
        items = feed.items.map(item => ({
          title: item.title, link: item.link, sourceId: source.id,
          source: feed.title?.split(' - ')[0] || source.id.toUpperCase(),
          pubDate: item.pubDate || item.isoDate, image: item.enclosure?.url || null,
          description: (item.contentSnippet || item.content || '').replace(/<[^>]*>/g, '').slice(0, 300)
        }));
      }
      items.forEach(item => {
        insertStmt.run(item.link, item.title, item.sourceId, item.pubDate, item.description, item.image, JSON.stringify(item), Date.now());
      });
    } catch (e) { console.error(`[SERVER] Fel vid ${source.id}: ${e.message}`); }
  }
  console.log('[SERVER] Bakgrundshämtning klar.');
}

// --- API ENDPOINTS ---
app.use(cors());

app.get('/api/dashboard-init', async (req, res) => {
  let topHeadlines = calculateTopHeadlines();
  
  // Om arkivet är tomt, tvinga en hämtning och vänta lite
  if (topHeadlines.length === 0) {
    console.log('[SERVER] Arkiv tomt, hämtar data nu...');
    await updateAllSources();
    topHeadlines = calculateTopHeadlines();
  }

  res.json({ topHeadlines, serverTime: new Date() });
});

app.get('/api/news', async (req, res) => {
  const { url, id } = req.query;
  // Hämta specifikt flöde (används för kategorierna)
  try {
    const feed = await parser.parseURL(url);
    const items = feed.items.map(item => ({
      title: item.title, link: item.link, sourceId: id,
      pubDate: item.pubDate || item.isoDate, description: item.contentSnippet || ''
    }));
    res.json(items);
  } catch (e) { res.status(500).send(e.message); }
});

app.listen(PORT, () => {
  console.log(`>>> Intelligence Engine v6.1 running on http://localhost:${PORT}`);
  updateAllSources(); // Hämta vid start
  setInterval(updateAllSources, 15 * 60 * 1000); // Var 15:e minut
});
