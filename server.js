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

// --- MASTER CONFIG ---
const GLOBAL_SOURCES = [
  { id: 'kris', name: 'Krisinformation', url: 'https://api.krisinformation.se/v3/news?days=3', category: 'Viktigt', weight: 100 },
  { id: 'svt', name: 'SVT Nyheter', url: 'https://www.svt.se/nyheter/rss.xml', category: 'Sverige', weight: 55 },
  { id: 'omni', name: 'Omni', url: 'https://omni.se/rss/nyheter', category: 'Sverige', weight: 50 },
  { id: 'dn', name: 'Dagens Nyheter', url: 'https://www.dn.se/rss/nyheter/', category: 'Sverige', weight: 50 },
  { id: 'svd', name: 'SvD', url: 'https://www.svd.se/?service=rss', category: 'Sverige', weight: 50 },
  { id: 'bbc', name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'Världen', weight: 55 },
  { id: 'npr', name: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml', category: 'Världen', weight: 55 },
  { id: 'ap', name: 'Assoc. Press', url: 'https://newsatme.com/ap-news-rss-feed/', category: 'Världen', weight: 60 },
  { id: 'nyt', name: 'NY Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', category: 'Världen', weight: 50 },
  { id: 'aljazeera', name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', category: 'Världen', weight: 45 },
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

const STOP_WORDS = new Set([
  // --- SVENSKA ---
  'och', 'det', 'att', 'i', 'en', 'jag', 'hon', 'han', 'på', 'den', 'med', 'var', 'sig', 'för', 
  'så', 'till', 'är', 'men', 'ett', 'om', 'hade', 'de', 'av', 'icke', 'mig', 'du', 'henne', 
  'då', 'sin', 'nu', 'har', 'inte', 'hans', 'honom', 'skulle', 'hennes', 'där', 'min', 'man', 
  'ej', 'vid', 'kunde', 'något', 'från', 'ut', 'när', 'efter', 'upp', 'vi', 'dem', 'vara', 
  'vad', 'över', 'än', 'dig', 'kan', 'sina', 'här', 'ha', 'mot', 'alla', 'under', 'någon', 
  'eller', 'allt', 'mycket', 'sedan', 'ju', 'denna', 'själv', 'detta', 'åt', 'utan', 'varit', 
  'hur', 'ingen', 'mitt', 'ni', 'bli', 'blev', 'oss', 'din', 'dessa', 'några', 'deras', 'bliver', 
  'mina', 'samma', 'vilken', 'er', 'sådan', 'vår', 'blivit', 'dess', 'inom', 'mellan', 'sådant', 
  'varför', 'varje', 'vilka', 'ditt', 'vem', 'vilket', 'sitta', 'sådana', 'vart', 'dina', 'vars', 
  'vårt', 'våra', 'ert', 'era', 'vilkas', 'just', 'bland', 'även', 'både', 'idag', 'igår',
  'säger', 'uppger', 'enligt', 'meddelar', 'skriver', 'finns', 'kommer', 'behöver', 'många', 
  'fler', 'stora', 'större', 'inför', 'redan', 'måste', 'får', 'mer', 'vill', 'varit', 'blir', 
  'ska', 'skall', 'skulle', 'kunna', 'fanns', 'fått', 'får', 'få', 'gå', 'gick', 'gått', 
  'gör', 'gjorde', 'gjort', 'tar', 'tog', 'tagit', 'ser', 'såg', 'sett', 'sitt', 'sina',

  // --- ENGELSKA ---
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 
  'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 
  'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 
  'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 
  'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 
  'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 
  'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 
  'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 
  'these', 'give', 'day', 'most', 'us', 'is', 'are', 'was', 'were', 'has', 'had', 'been',
  'says', 'said', 'reported', 'according', 'breaking', 'live', 'update', 'video', 'news',
  'more', 'top', 'best', 'review', 'analysis', 'watch', 'found', 'during', 'since', 'while'
]);

function getKeywords(text) {
  if (!text) return [];
  return text.toLowerCase()
    .replace(/[^\w\s\u00C0-\u00FF]/g, '') // Behåll bokstäver inkl ÅÄÖ
    .replace(/\d+/g, '')                  // Ta bort siffror
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w));
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
  const allArticles = db.prepare("SELECT * FROM articles WHERE pubDateMs > ?").all(now - (24 * 60 * 60 * 1000));
  
  if (allArticles.length === 0) return { articles: [], trends: [] };

  const trendMap = new Map();
  
  // 1. Analysera text och hitta BÅDE ord och ordpar
  allArticles.forEach(art => {
    const words = getKeywords(art.title);
    
    // A. Räkna enskilda ord
    words.forEach(word => {
      trendMap.set(word, (trendMap.get(word) || 0) + 1);
    });

    // B. Räkna ORDPAR (Bigrams)
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = words[i] + ' ' + words[i+1];
      trendMap.set(bigram, (trendMap.get(bigram) || 0) + 1.2); // Ge par lite högre vikt
    }
  });

  // 2. Poängsätt artiklar
  const scored = allArticles.map(art => {
    let score = 10;
    const words = getKeywords(art.title);
    words.forEach(word => score += (trendMap.get(word) || 0) * 20);
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = words[i] + ' ' + words[i+1];
      score += (trendMap.get(bigram) || 0) * 30; // Extra bonus för bigram-matchning
    }
    
    const meta = GLOBAL_SOURCES.find(s => s.id === art.sourceId);
    score += (meta ? meta.weight : 25);
    const ageInHours = (now - art.pubDateMs) / (1000 * 60 * 60);
    return { ...art, rankScore: score / (1 + (ageInHours / 4)) };
  });

  // 3. Sortera och klustra
  const sorted = scored.sort((a, b) => b.rankScore - a.rankScore);
  const distinct = [];
  for (const art of sorted) {
    if (distinct.length >= 10) break;
    const existingIdx = distinct.findIndex(existing => calculateSimilarity(existing, art) > 0.25);
    if (existingIdx === -1) {
      distinct.push({ ...JSON.parse(art.fullJson), rankScore: art.rankScore });
    } else {
      distinct[existingIdx].rankScore += (art.rankScore * 0.5);
    }
  }

  // 4. SMART TREND-URVAL (Prioritera sammanhang)
  const allTrends = [...trendMap.entries()].sort((a, b) => {
    const aIsBigram = a[0].includes(' ');
    const bIsBigram = b[0].includes(' ');
    
    // Om ett av termerna är ett bigram och de har liknande count, prioritera bigrammet
    if (aIsBigram && !bIsBigram && a[1] * 1.5 >= b[1]) return -1;
    if (bIsBigram && !aIsBigram && b[1] * 1.5 >= a[1]) return 1;
    
    return b[1] - a[1]; // Annars vanlig count-sortering
  });

  const finalTrends = [];
  const usedWords = new Set();

  for (const [term, count] of allTrends) {
    if (finalTrends.length >= 10) break;
    if (count < 1.5 && trendMap.size > 20) continue; // Brusfilter (par har 1.2+ bas)

    const parts = term.split(' ');
    // Kolla om ALLA delar av termen är lediga
    const isAvailable = parts.every(p => !usedWords.has(p));

    if (isAvailable) {
      finalTrends.push(term);
      parts.forEach(p => usedWords.add(p));
    }
  }

  console.log(`[MX] Bigram Analys klar. Topp-trender: ${finalTrends.join(', ')}`);
  return { articles: distinct.sort((a, b) => b.rankScore - a.rankScore), trends: finalTrends };
}

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
  
  // Security: Clean wildcards
  q = q.replace(/[%_]/g, '');
  
  // 1. Hämta rådata (sorterat nyast först)
  const hits = db.prepare(`
    SELECT * FROM articles 
    WHERE title LIKE ? OR description LIKE ? 
    ORDER BY pubDateMs DESC LIMIT 100
  `).all(`%${q}%`, `%${q}%`);

  // 2. STÄDA DUBBLETTER (Deduplicering)
  const distinctHits = [];
  
  for (const hit of hits) {
    // Kolla om vi redan har sparat en snarlik artikel från SAMMA källa
    const isDuplicate = distinctHits.some(existing => {
      // Om det är samma källa (t.ex. SvD vs SvD), var stenhård med likhet
      if (existing.sourceId === hit.sourceId) {
        return calculateSimilarity(existing, hit) > 0.4;
      }
      return false;
    });

    if (!isDuplicate) {
      distinctHits.push(hit);
    }
  }

  // 3. Returnera de 50 bästa unika träffarna
  res.json(distinctHits.slice(0, 50).map(h => ({
    ...JSON.parse(h.fullJson), 
    pubDate: h.pubDate 
  })));
});


app.get('/api/feed', (req, res) => {
  const sources = req.query.sources ? req.query.sources.split(',') : [];
  if (sources.length === 0) return res.json([]);
  const placeholders = sources.map(() => '?').join(',');
  const articles = db.prepare(`SELECT * FROM articles WHERE sourceId IN (${placeholders}) ORDER BY pubDateMs DESC LIMIT 200`).all(sources);
  res.json(articles.map(art => ({ ...JSON.parse(art.fullJson), pubDate: art.pubDate })));
});

async function fetchWithRetry(url, id) {
  try {
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 StartsidanPro/10.4' }, timeout: 15000, httpsAgent: agent });
    
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

    if (id === 'kris') {
      return res.data.map(item => {
        const pDate = item.Published;
        return {
          title: "⚠️ " + item.PushMessage,
          link: `https://krisinformation.se/nyheter/${item.Id}`,
          sourceId: 'kris', sourceName: 'KRISINFORMATION',
          pubDate: pDate, pubDateMs: new Date(pDate).getTime(),
          description: item.BodyText || item.PushMessage, image: null
        };
      });
    }

    if (id === 'hn') {
      const feed = await parser.parseString(res.data);
      return feed.items
        .filter(i => !i.link.includes('ycombinator.com/companies') && !i.title.toLowerCase().includes('is hiring'))
        .map(i => ({
          title: i.title, link: i.link, sourceId: 'hn', sourceName: 'HACKER NEWS',
          pubDate: i.isoDate || new Date().toISOString(), 
          pubDateMs: new Date(i.isoDate || Date.now()).getTime(),
          description: '', image: null
        }));
    }

    const feed = await parser.parseString(res.data);
    return feed.items.map(i => {
      const pDate = i.pubDate || i.isoDate || new Date().toISOString();
      const img = i.enclosure?.url || i.mediaContent?.$.url || i.content?.match(/src="([^"]+)"/)?.[1] || null;
      return {
        title: i.title, link: i.link, sourceId: id, sourceName: feed.title?.split(' - ')[0] || id.toUpperCase(),
        pubDate: pDate, pubDateMs: new Date(pDate).getTime(),
        description: (i.contentSnippet || "").replace(/<[^>]*>/g, '').slice(0, 300),
        image: img
      };
    });
  } catch (e) { return []; }
}

async function updateAllSources() {
  console.log('[SERVER] Synkar källor...');
  const chunks = [];
  for (let i = 0; i < GLOBAL_SOURCES.length; i += 3) {
    chunks.push(GLOBAL_SOURCES.slice(i, i + 3));
  }

  for (const chunk of chunks) {
    await Promise.all(chunk.map(async (source) => {
      const items = await fetchWithRetry(source.url, source.id);
      items.forEach(i => insertStmt.run(i.link, i.title, i.sourceId, i.sourceName, i.pubDate, i.pubDateMs, i.description, i.image, JSON.stringify(i), Date.now()));
    }));
    await new Promise(r => setTimeout(r, 300));
  }

  const cutoff = Date.now() - (48 * 60 * 60 * 1000);
  const result = db.prepare("DELETE FROM articles WHERE pubDateMs < ?").run(cutoff);
  if (result.changes > 0) console.log(`[STÄDNING] Rensade bort ${result.changes} gamla artiklar.`);
  console.log('[SERVER] Synk klar.');
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`>>> Intelligence Engine v10.4 (Multi-Language Analytics) on port ${PORT}`);
  db.exec("VACUUM");
  updateAllSources();
  setInterval(updateAllSources, 15 * 60 * 1000);
});
