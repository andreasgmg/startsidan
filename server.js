import express from 'express';
import cors from 'cors';
import RSSParser from 'rss-parser';
import axios from 'axios';
import Database from 'better-sqlite3';

const app = express();
const parser = new RSSParser({
  timeout: 10000,
  headers: { 'User-Agent': 'StartsidanPro/7.0' }
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

// --- RANKING & ANALYTICS ENGINE v7.0 ---

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

  // 1. Trend-analys över 24 timmar (Ingen Cliff Edge)
  const trendMap = new Map();
  allArticles.forEach(art => {
    const words = [...new Set(getKeywords(art.title))];
    words.forEach(word => trendMap.set(word, (trendMap.get(word) || 0) + 1));
  });

  // 2. Initial Scoring
  const scored = allArticles.map(art => {
    let score = 10;
    const ageInHours = (now - new Date(art.pubDate).getTime()) / (1000 * 60 * 60);
    
    // Topic weight
    getKeywords(art.title).forEach(word => {
      const freq = trendMap.get(word) || 0;
      if (freq > 1) score += (freq * 20);
    });

    // Authority weight
    const sourceWeights = { 'svt': 50, 'dn': 45, 'reuters': 50, 'bbc': 50, 'reddit': 10 };
    score += (sourceWeights[art.sourceId] || 25);

    // Mjukare Time Decay (Halveringstid på 4 timmar)
    const finalScore = score / (1 + (ageInHours / 4));
    return { ...art, rankScore: finalScore };
  });

  // 3. Jaccard Clustering med Poäng-förstärkning
  const sorted = scored.sort((a, b) => b.rankScore - a.rankScore);
  const distinctArticles = [];

  for (const art of sorted) {
    const existingIndex = distinctArticles.findIndex(existing => calculateSimilarity(existing, art) > 0.3);
    
    if (existingIndex !== -1) {
      // Förstärk poängen för det befintliga klustret
      distinctArticles[existingIndex].rankScore += (art.rankScore * 0.5);
      
      // Uppdatera till den nyaste artikeln om den är fräschare
      if (new Date(art.pubDate) > new Date(distinctArticles[existingIndex].pubDate)) {
        const currentScore = distinctArticles[existingIndex].rankScore;
        const parsed = JSON.parse(art.fullJson);
        distinctArticles[existingIndex] = { ...parsed, rankScore: currentScore };
      }
    } else {
      const parsed = JSON.parse(art.fullJson);
      distinctArticles.push({ ...parsed, rankScore: art.rankScore });
    }
  }

  // Slutgiltig sortering efter den förstärkta poängen
  return distinctArticles.sort((a, b) => b.rankScore - a.rankScore).slice(0, 10);
}

// --- NEWS FETCHING SERVICE ---
const newsSources = [
  { id: 'svt', url: 'https://www.svt.se/nyheter/rss.xml' },
  { id: 'dn', url: 'https://www.dn.se/rss/nyheter/' },
  { id: 'svd', url: 'https://www.svd.se/?service=rss' },
  { id: 'bbc', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { id: 'reuters', url: 'https://www.reuters.com/world/rss' },
  { id: 'ap', url: 'https://newsatme.com/ap-news-rss-feed/' },
  { id: 'nyt', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
  { id: 'reddit', url: 'https://www.reddit.com/r/popular/top.json?t=day&limit=15' }
];

async function updateAllSources() {
  console.log('[SERVER] Synkroniserar källor...');
  for (const source of newsSources) {
    try {
      let items = [];
      if (source.id === 'reddit') {
        const response = await axios.get(source.url, { headers: { 'User-Agent': 'StartsidanPro/7.0' } });
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
}

// --- API ENDPOINTS ---
app.use(cors());

app.get('/api/dashboard-init', async (req, res) => {
  try {
    const topHeadlines = calculateTopHeadlines();
    res.json({ topHeadlines, serverTime: new Date() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/news', async (req, res) => {
  const { url, id } = req.query;
  try {
    const feed = await parser.parseURL(url);
    res.json(feed.items.slice(0, 25).map(item => ({
      title: item.title, link: item.link, sourceId: id,
      pubDate: item.pubDate || item.isoDate, description: (item.contentSnippet || "").slice(0, 200)
    })));
  } catch (e) { res.status(500).send(e.message); }
});

app.listen(PORT, () => {
  console.log(`\x1b[32m%s\x1b[0m`, `>>> Intelligence Engine v7.0 (Anti-ADHD) running on port ${PORT}`);
  updateAllSources();
  setInterval(updateAllSources, 15 * 60 * 1000);
});