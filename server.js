import express from 'express';
import cors from 'cors';
import RSSParser from 'rss-parser';
import axios from 'axios';
import Database from 'better-sqlite3';
import https from 'https';
import { newStemmer } from 'snowball-stemmers';

const app = express();
const stemmer = newStemmer('swedish');

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

  -- TF-IDF Stats
  CREATE TABLE IF NOT EXISTS word_stats (
    word TEXT PRIMARY KEY,
    doc_count INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS meta_stats (
    key TEXT PRIMARY KEY,
    value INTEGER
  );
  INSERT OR IGNORE INTO meta_stats (key, value) VALUES ('total_articles', 0);
`);

const insertHot = db.prepare(`
  INSERT OR REPLACE INTO articles (link, title, sourceId, sourceName, pubDate, pubDateMs, description, image, sentiment, fullJson, createdAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertArchive = archiveDb.prepare(`
  INSERT OR IGNORE INTO articles (link, title, sourceId, pubDateMs, fullJson, sentiment)
  VALUES (?, ?, ?, ?, ?, ?)
`);

// --- TF-IDF HELPER ---
const updateWordStats = archiveDb.transaction((articles) => {
  let newDocs = 0;
  const wordUpdate = archiveDb.prepare("INSERT INTO word_stats (word, doc_count) VALUES (?, 1) ON CONFLICT(word) DO UPDATE SET doc_count = doc_count + 1");
  
  for (const art of articles) {
    newDocs++;
    const text = (art.title + " " + (art.description || ""));
    // Re-use logic similar to getKeywords but simplified for stats
    const tokens = text.trim().split(/\s+/);
    const uniqueStems = new Set();
    
    for (const t of tokens) {
        const clean = t.replace(/[^\w\s\u00C0-\u00FF]/g, '').toLowerCase();
        if (clean.length < 2 || STOP_WORDS.has(clean)) continue;
        
        // We assume stats building doesn't need strict NER weight, just presence
        const parts = decomposeCompound(clean);
        parts.forEach(p => {
             if (p.length > 2 && !STOP_WORDS.has(p)) uniqueStems.add(stemWord(p));
        });
    }

    for (const stem of uniqueStems) {
      wordUpdate.run(stem);
    }
  }
  archiveDb.prepare("UPDATE meta_stats SET value = value + ? WHERE key = 'total_articles'").run(newDocs);
});

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

// --- SOURCES DB SETUP ---
db.exec(`
  CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    name TEXT,
    url TEXT,
    category TEXT,
    weight INTEGER
  );
`);

const sourceCount = db.prepare("SELECT count(*) as c FROM sources").get().c;
if (sourceCount === 0) {
  console.log('[SERVER] Migrating sources to database...');
  const INITIAL_SOURCES = [
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
  
  const insertSource = db.prepare("INSERT INTO sources (id, name, url, category, weight) VALUES (?, ?, ?, ?, ?)");
  const insertTransaction = db.transaction((list) => {
    for (const s of list) insertSource.run(s.id, s.name, s.url, s.category, s.weight);
  });
  insertTransaction(INITIAL_SOURCES);
}

const STOP_WORDS = new Set(['och', 'det', 'att', 'i', 'en', 'jag', 'hon', 'han', 'på', 'den', 'med', 'var', 'sig', 'för', 'så', 'till', 'är', 'men', 'ett', 'om', 'hade', 'de', 'av', 'icke', 'mig', 'du', 'henne', 'då', 'sin', 'nu', 'har', 'inte', 'hans', 'honom', 'skulle', 'hennes', 'där', 'min', 'man', 'ej', 'vid', 'kunde', 'något', 'från', 'ut', 'när', 'efter', 'upp', 'vi', 'dem', 'vara', 'vad', 'över', 'än', 'dig', 'kan', 'sina', 'här', 'ha', 'mot', 'alla', 'under', 'någon', 'eller', 'allt', 'mycket', 'sedan', 'ju', 'denna', 'själv', 'detta', 'åt', 'utan', 'varit', 'hur', 'ingen', 'mitt', 'ni', 'bli', 'blev', 'oss', 'din', 'dessa', 'några', 'deras', 'bliver', 'mina', 'samma', 'vilken', 'er', 'sådan', 'vår', 'blivit', 'dess', 'inom', 'mellan', 'sådant', 'varför', 'varje', 'vilka', 'ditt', 'vem', 'vilket', 'sitta', 'sådana', 'vart', 'dina', 'vars', 'vårt', 'våra', 'ert', 'era', 'vilkas', 'just', 'bland', 'även', 'både', 'idag', 'igår', 'säger', 'uppger', 'enligt', 'meddelar', 'skriver', 'finns', 'kommer', 'behöver', 'många', 'fler', 'stora', 'inför', 'redan', 'måste', 'får', 'mer', 'vill', 'varit', 'blir', 'ska', 'skall', 'skulle', 'kunna', 'finns', 'fanns', 'fått', 'får', 'få', 'gå', 'gick', 'gått', 'gör', 'gjorde', 'gjort', 'tar', 'tog', 'tagit', 'ser', 'såg', 'sett', 'sitt', 'sina', 'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us', 'is', 'are', 'was', 'were', 'has', 'had', 'been', 'says', 'said', 'reported', 'according', 'breaking', 'live', 'update', 'video', 'news', 'more', 'top', 'best', 'review', 'analysis', 'watch', 'found', 'during', 'since', 'while']);



// --- NLP HELPERS (Stemming & Compound Splitting) ---
const COMMON_WORDS = new Set();

function loadCommonWords() {
  try {
    const rows = archiveDb.prepare("SELECT word FROM word_stats ORDER BY doc_count DESC LIMIT 8000").all();
    rows.forEach(r => COMMON_WORDS.add(r.word));
    console.log(`[NLP] Loaded ${COMMON_WORDS.size} common stems for compound splitting.`);
  } catch (e) {
    console.error("[NLP] Failed to load common words:", e);
  }
}

function stemWord(word) {
  return stemmer.stem(word.toLowerCase());
}

function decomposeCompound(word) {
  const w = word.toLowerCase();
  if (w.length < 8) return [w];
  
  const wStem = stemWord(w);
  if (COMMON_WORDS.has(wStem)) return [w];

  // Try split
  for (let i = 4; i <= w.length - 4; i++) {
    const p1 = w.slice(0, i);
    const p2 = w.slice(i);
    
    // Check parts. 
    // Case 1: Direct concat
    if (COMMON_WORDS.has(stemWord(p1)) && COMMON_WORDS.has(stemWord(p2))) {
      return [p1, p2];
    }

    // Case 2: 's' genitive glue
    if (p1.endsWith('s')) {
      const p1NoS = p1.slice(0, -1);
      if (COMMON_WORDS.has(stemWord(p1NoS)) && COMMON_WORDS.has(stemWord(p2))) {
        return [p1NoS, p2];
      }
    }
  }
  return [w];
}



// Returns list of { stem, original, weight }
function getKeywords(text) {
  if (!text) return [];
  // Tokenize preserving case and position first
  const tokens = text.trim().split(/\s+/);
  const results = [];
  
  tokens.forEach((t, index) => {
    // Clean but keep case for NER check
    const cleanRaw = t.replace(/[^\w\s\u00C0-\u00FF]/g, ''); 
    if (cleanRaw.length < 2) return;
    
    // NER Light: Capitalized and NOT first word -> High Weight (Proper Noun candidate)
    const isName = index > 0 && /^[A-Z\u00C0-\u00DD]/.test(cleanRaw);
    const weight = isName ? 3.0 : 1.0;
    
    // Now lower for processing
    const lower = cleanRaw.toLowerCase();
    if (STOP_WORDS.has(lower)) return;

    const parts = decomposeCompound(lower); 
    parts.forEach(p => {
      // Re-filter parts
      if (p.length > 2 && !STOP_WORDS.has(p)) {
        results.push({ 
          stem: stemWord(p), 
          original: p, 
          weight: weight 
        });
      }
    });
  });
  return results;
}

function calculateSimilarity(articleA, articleB) {
  const kA = getKeywords(articleA.title);
  const kB = getKeywords(articleB.title);
  
  // Map stem -> Max weight found for that stem
  const mapA = new Map();
  kA.forEach(k => mapA.set(k.stem, Math.max(mapA.get(k.stem) || 0, k.weight)));
  
  const mapB = new Map();
  kB.forEach(k => mapB.set(k.stem, Math.max(mapB.get(k.stem) || 0, k.weight)));
  
  let intersectionScore = 0;
  let unionScore = 0;
  
  const allStems = new Set([...mapA.keys(), ...mapB.keys()]);
  
  for (const s of allStems) {
    const wA = mapA.get(s) || 0;
    const wB = mapB.get(s) || 0;
    
    // Weighted Jaccard
    intersectionScore += Math.min(wA, wB);
    unionScore += Math.max(wA, wB);
  }
  
  return unionScore === 0 ? 0 : intersectionScore / unionScore;
}

function calculateTopHeadlines() {
  const now = Date.now();
  const dayAgo = now - (24 * 60 * 60 * 1000);
  const twoHoursAgo = now - (2 * 60 * 60 * 1000);
  
  // 0. Fetch Config
  const allSources = db.prepare("SELECT * FROM sources").all();
  
  // 1. Fetch Candidates (Last 24h)
  const allArticles = db.prepare("SELECT * FROM articles WHERE pubDateMs > ?").all(dayAgo);
  if (allArticles.length === 0) return { articles: [], trends: [] };

  // 2. Global Stats (IDF context)
  const meta = archiveDb.prepare("SELECT value FROM meta_stats WHERE key = 'total_articles'").get();
  const archiveTotal = meta ? meta.value : 0;
  const totalDocs = archiveTotal + allArticles.length;

  // 3. Local Frequencies & Acceleration
  const tfMap = new Map();       
  const velocityMap = new Map(); 
  const displayMap = new Map();  
  const stemSet = new Set();

  allArticles.forEach(art => {
    const keywords = getKeywords(art.title);
    const isRecent = art.pubDateMs > twoHoursAgo;
    
    keywords.forEach(k => {
      const s = k.stem;
      const o = k.original;
      
      stemSet.add(s);
      tfMap.set(s, (tfMap.get(s) || 0) + 1);
      if (isRecent) velocityMap.set(s, (velocityMap.get(s) || 0) + 1);

      if (!displayMap.has(s)) displayMap.set(s, {});
      const forms = displayMap.get(s);
      forms[o] = (forms[o] || 0) + 1;
    });
  });

  // 4. Batch Fetch Global DF
  let dfMap = new Map();
  if (stemSet.size > 0) {
    const distinctStems = Array.from(stemSet);
    const chunkSize = 900;
    for (let i = 0; i < distinctStems.length; i += chunkSize) {
      const chunk = distinctStems.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => '?').join(',');
      const rows = archiveDb.prepare(`SELECT word, doc_count FROM word_stats WHERE word IN (${placeholders})`).all(chunk);
      rows.forEach(r => dfMap.set(r.word, r.doc_count));
    }
  }

  // 5. Calculate Score per Stem
  const stemScores = new Map();
  stemSet.forEach(s => {
    const tf = tfMap.get(s); 
    const recentCount = velocityMap.get(s) || 0;
    const globalDf = (dfMap.get(s) || 0) + tf;
    const idf = Math.log10((totalDocs + 1) / (globalDf + 1));
    const avgRate = tf / 24; 
    const currentRate = recentCount / 2;
    
    let acceleration = 1;
    if (avgRate > 0) acceleration = currentRate / avgRate;
    
    let accelBonus = 1;
    if (acceleration > 1.5) accelBonus = 1 + (acceleration * 0.5); 
    
    const score = tf * idf * accelBonus;
    stemScores.set(s, score);
  });

  // 6. Score Individual Articles
  const scored = allArticles.map(art => {
    let score = 0;
    const keywords = getKeywords(art.title);
    keywords.forEach(k => score += (stemScores.get(k.stem) || 0));

    const meta = allSources.find(s => s.id === art.sourceId);
    if (meta) score *= (1 + (meta.weight / 200)); 

    const ageHours = (now - art.pubDateMs) / (3600000);
    score = score / (1 + (ageHours / 12));

    return { ...art, rankScore: score };
  });

  // 7. Clustering (The "Galning" Fix)
  const clusters = [];
  const processed = new Set();
  
  // Sort by score to start clusters with strongest candidates
  scored.sort((a, b) => b.rankScore - a.rankScore);
  
  for (let i = 0; i < scored.length; i++) {
    if (processed.has(i)) continue;
    
    const seed = scored[i];
    const cluster = [seed];
    processed.add(i);
    
    const seedCategory = allSources.find(s => s.id === seed.sourceId)?.category;

    for (let j = i + 1; j < scored.length; j++) {
      if (processed.has(j)) continue;
      const candidate = scored[j];
      
      // A. Category Check
      const candCategory = allSources.find(s => s.id === candidate.sourceId)?.category;
      const sameCategory = seedCategory && candCategory && seedCategory === candCategory;
      
      // B. Time Check (45 mins window as per user suggestion for high prob)
      const timeDiff = Math.abs(seed.pubDateMs - candidate.pubDateMs);
      const isCloseTime = timeDiff < (45 * 60 * 1000); 
      
      // C. Adaptive Similarity Threshold
      let threshold = 0.28; // Base threshold
      if (sameCategory && isCloseTime) threshold = 0.18; // Very loose if same context/time
      else if (!sameCategory) threshold = 0.45; // Strict if diff category
      
      // D. Weighted Similarity (NER Light included)
      const sim = calculateSimilarity(seed, candidate);
      
      if (sim > threshold) {
        cluster.push(candidate);
        processed.add(j);
      }
    }
    clusters.push(cluster);
  }
  
  // 8. Score Clusters & Pick Representatives
  const clusterResults = clusters.map(c => {
    const distinctSources = new Set(c.map(a => a.sourceId)).size;
    const totalScore = c.reduce((sum, a) => sum + a.rankScore, 0);
    
    // Diversity Boost: e.g. 1 source -> 1x, 3 sources -> 2.58x
    const diversityBoost = 1 + Math.log2(distinctSources); 
    
    // Representative: Highest scored article
    // We parse JSON here to return clean object
    const representative = c.reduce((prev, curr) => curr.rankScore > prev.rankScore ? curr : prev);
    const parsed = JSON.parse(representative.fullJson);
    
    return {
       ...parsed,
       rankScore: totalScore * diversityBoost, // Use Cluster Score for final sorting
       clusterSize: c.length,
       sourceCount: distinctSources
    };
  });
  
  // 9. Final Sort & Trends
  const finalArticles = clusterResults
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, 20); // Top 20 stories

  // Extract Trends from top stories
  // Re-collect stems from top stories to ensure trends match visible news
  const visibleStems = new Set();
  finalArticles.forEach(a => {
    getKeywords(a.title).forEach(k => visibleStems.add(k.stem));
  });

  const sortedStems = [...stemScores.entries()]
    .filter(e => visibleStems.has(e[0])) // Only show trends relevant to top news
    .sort((a, b) => b[1] - a[1]);
    
  const finalTrends = [];
  const usedTrends = new Set();
  
  for (const [stem, score] of sortedStems) {
    if (finalTrends.length >= 10) break;
    if (score < 0.5) continue;
    
    const forms = displayMap.get(stem);
    const bestForm = Object.entries(forms).sort((a, b) => b[1] - a[1])[0][0];
    const display = bestForm.charAt(0).toUpperCase() + bestForm.slice(1);

    if (!usedTrends.has(display)) {
      finalTrends.push(display);
      usedTrends.add(display);
    }
  }

  return { articles: finalArticles, trends: finalTrends };
}

function deduplicateList(articles) {
  const seen = new Set();
  const clean = [];
  
  for (const art of articles) {
    // 1. Strict normalization check
    const norm = art.title.toLowerCase().replace(/[^À-ÿ\w]/g, '').slice(0, 50);
    if (seen.has(norm)) continue;
    
    // 2. Similarity check (Smart Dedup)
    // Only check against recent accepted items to be fast
    let isDup = false;
    // Check last 20 items
    const startIdx = Math.max(0, clean.length - 20);
    for (let i = startIdx; i < clean.length; i++) {
       const existing = clean[i];
       // If very similar > 0.5 (e.g. "Brand i hus" vs "Husbrand"), skip
       if (calculateSimilarity(art, existing) > 0.5) {
         isDup = true;
         break;
       }
    }
    
    if (!isDup) {
      seen.add(norm);
      clean.push(art);
    }
  }
  return clean;
}

// --- API ---
app.use(cors());

app.get('/api/config/sources', (req, res) => {
  res.json(db.prepare("SELECT id, name, category, weight FROM sources").all());
});

app.get('/api/dashboard-init', (req, res) => {
  // Serve from cache - lightning fast ⚡
  res.json({ topHeadlines: cachedResult.articles, trends: cachedResult.trends });
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
      distinctHits.push({ ...parsed, pubDateMs: hit.pubDateMs });
    }
  }
  res.json(distinctHits.sort((a, b) => b.pubDateMs - a.pubDateMs).slice(0, 50));
});

app.get('/api/feed', (req, res) => {
  const sources = req.query.sources ? req.query.sources.split(',') : [];
  if (sources.length === 0) return res.json([]);
  const placeholders = sources.map(() => '?').join(',');
  const articles = db.prepare(`SELECT fullJson, pubDateMs, sentiment FROM articles WHERE sourceId IN (${placeholders}) ORDER BY pubDateMs DESC LIMIT 200`).all(sources);
  const rawList = articles.map(art => ({ ...JSON.parse(art.fullJson), pubDateMs: art.pubDateMs }));
  res.json(deduplicateList(rawList));
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
          description: c.data.selftext, image: null, sentiment: 0
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
          description: item.BodyText || item.PushMessage, image: null, sentiment: 0
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
        description: desc, image: img, sentiment: 0
      };
    });
  } catch (e) { return []; }
}

// --- CACHE ---
let cachedResult = { articles: [], trends: [] };

async function updateAllSources() {
  console.log('[SERVER] Synkar källor...');
  const sources = db.prepare("SELECT * FROM sources").all();
  const chunks = [];
  for (let i = 0; i < sources.length; i += 3) chunks.push(sources.slice(i, i + 3));
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
    // Update global stats with the moved articles
    updateWordStats(oldArticles);
    db.prepare("DELETE FROM articles WHERE pubDateMs < ?").run(cutoff);
  }
  
  // Refresh Cache
  console.log('[SERVER] Recalculating Top Headlines...');
  cachedResult = calculateTopHeadlines();
  console.log(`[SERVER] Cache updated. Found ${cachedResult.articles.length} top stories and ${cachedResult.trends.length} trends.`);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`>>> Intelligence Engine v11.4 (Archive Edition) on port ${PORT}`);
  db.exec("VACUUM");
  archiveDb.exec("VACUUM");
  
  // Seed stats if empty
  const totalDocs = archiveDb.prepare("SELECT value FROM meta_stats WHERE key = 'total_articles'").get()?.value || 0;
  if (totalDocs === 0) {
    console.log('[SERVER] Initializing Global Word Stats from Archive (this may take a moment)...');
    const allArchived = archiveDb.prepare("SELECT title, description FROM articles").all();
    if (allArchived.length > 0) {
      updateWordStats(allArchived);
      console.log(`[SERVER] Stats initialized with ${allArchived.length} articles.`);
    }
  }

  loadCommonWords();
  
  // Initial calculation before first fetch if DB has data
  cachedResult = calculateTopHeadlines();
  
  updateAllSources();
  setInterval(updateAllSources, 15 * 60 * 1000);
});