import express from 'express';
import cors from 'cors';
import RSSParser from 'rss-parser';
import axios from 'axios';

const app = express();
const parser = new RSSParser({
  timeout: 10000,
  headers: { 'User-Agent': 'Mozilla/5.0 StartsidanPro/4.0' }
});
const PORT = 3001;

app.use(cors());

// --- DATA PERSISTENCE (In-memory för demo, men strukturerad för ranking) ---
let globalArchive = new Map(); // Link -> Article Object
const MAX_AGE_HOURS = 24;

// --- RANKING ENGINE LOGIC ---

// 1. Enkel "Entity Extraction" (Hittar signifikanta ord)
function getKeywords(text) {
  if (!text) return [];
  // Vi letar efter ord med stor begynnelsebokstav (Proper nouns) eller långa ord
  // Detta är en lättviktsversion av NLP
  return text.match(/[A-ZÅÄÖ][a-zåäö]{3,}/g) || [];
}

function calculateTopHeadlines() {
  const now = new Date();
  const allArticles = Array.from(globalArchive.values());
  
  // A. Räkna frekvens av ord över ALLA källor senaste 6 timmarna
  const trendMap = new Map();
  const recentArticles = allArticles.filter(a => (now - new Date(a.pubDate)) < 6 * 60 * 60 * 1000);
  
  recentArticles.forEach(art => {
    const words = [...new Set(getKeywords(art.title))];
    words.forEach(word => {
      trendMap.set(word, (trendMap.get(word) || 0) + 1);
    });
  });

  // B. Scora artiklar
  const scored = allArticles.map(art => {
    let score = 10; // Baspoäng
    const ageInHours = (now - new Date(art.pubDate)) / (1000 * 60 * 60);
    
    // 1. Topic Score: Hur många trendande ord innehåller rubriken?
    const words = getKeywords(art.title);
    words.forEach(word => {
      const freq = trendMap.get(word) || 0;
      if (freq > 1) score += (freq * 15); // Bonus om ordet dyker upp i flera källor
    });

    // 2. Logaritmisk Time Decay: Score = Base / (age + 1)^1.5
    // Detta låter viktiga nyheter ligga kvar längre än linjär decay
    const finalScore = score / Math.pow(ageInHours + 1, 1.2);

    return { ...art, rankScore: finalScore };
  });

  // C. Sortera och filtrera dubbletter (Klustring)
  const sorted = scored.sort((a, b) => b.rankScore - a.rankScore);
  const swedishIds = ['svt', 'dn', 'svd', 'sc'];
  
  const topSwedish = [];
  const topGlobal = [];
  const seenClusters = new Set();
  
  // 1. Hämta 5 bästa SVENSKA
  for (const art of sorted) {
    if (topSwedish.length >= 5) break;
    if (!swedishIds.includes(art.sourceId)) continue;
    
    const clusterId = getKeywords(art.title).slice(0, 3).join('_');
    if (!seenClusters.has(clusterId)) {
      topSwedish.push(art);
      seenClusters.add(clusterId);
    }
  }

  // 2. Hämta 5 bästa GLOBALA
  for (const art of sorted) {
    if (topGlobal.length >= 5) break;
    if (swedishIds.includes(art.sourceId)) continue;
    
    const clusterId = getKeywords(art.title).slice(0, 3).join('_');
    if (!seenClusters.has(clusterId)) {
      topGlobal.push(art);
      seenClusters.add(clusterId);
    }
  }

  // Slå ihop (Svenska först för relevans, eller sortera efter total score?)
  // Vi kör de 10 bästa sorterat efter rankScore för att få den absolut tyngsta nyheten först
  return [...topSwedish, ...topGlobal].sort((a, b) => b.rankScore - a.rankScore);
}

// --- ENDPOINTS ---

app.get('/api/news', async (req, res) => {
  const { url, id } = req.query;
  try {
    let items = [];
    if (id === 'reddit') {
      const response = await axios.get(url, { headers: { 'User-Agent': 'StartsidanPro/4.0' } });
      items = response.data.data.children.map(child => ({
        title: child.data.title,
        link: `https://reddit.com${child.data.permalink}`,
        source: `REDDIT R/${child.data.subreddit.toUpperCase()}`,
        sourceId: 'reddit',
        pubDate: new Date(child.data.created_utc * 1000).toISOString(),
        description: child.data.selftext
      }));
    } else {
      const feed = await parser.parseURL(url);
      items = feed.items.map(item => ({
        title: item.title,
        link: item.link,
        source: feed.title?.split(' - ')[0] || id.toUpperCase(),
        sourceId: id,
        pubDate: item.pubDate || item.isoDate,
        description: item.contentSnippet || item.content,
        image: item.enclosure?.url || null
      }));
    }

    // Arkivera
    items.forEach(item => globalArchive.set(item.link, item));
    
    // Rensa gamla
    const dayAgo = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000);
    for (let [link, art] of globalArchive) {
      if (new Date(art.pubDate) < dayAgo) globalArchive.delete(link);
    }

    res.json(items.slice(0, 25));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/top-headlines', (req, res) => {
  res.json(calculateTopHeadlines());
});

app.listen(PORT, () => {
  console.log(`[OK] Intelligence Engine v6.0 running on port ${PORT}`);
});
