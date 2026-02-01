import express from 'express';
import cors from 'cors';
import RSSParser from 'rss-parser';
import axios from 'axios';

const app = express();
const parser = new RSSParser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  }
});
const PORT = 3001;

app.use(cors());

// --- NYHETSARKIVET (Håller nyheter i 24 timmar) ---
let newsArchive = [];
const ARCHIVE_LIMIT = 24 * 60 * 60 * 1000; // 24 timmar i ms

const cleanDescription = (str) => {
  if (!str) return "";
  return str.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
}

// Hjälpfunktion för att lägga till i arkivet utan dubbletter
const addToArchive = (newItems) => {
  const now = Date.now();
  
  newItems.forEach(item => {
    // Kolla om artikeln redan finns (baserat på URL eller titel)
    const exists = newsArchive.find(a => a.link === item.link || a.title === item.title);
    if (!exists) {
      newsArchive.push({ ...item, firstSeen: now });
    }
  });

  // Rensa ut gamla nyheter (> 24h)
  newsArchive = newsArchive.filter(item => (now - new Date(item.pubDate).getTime()) < ARCHIVE_LIMIT);
  
  // Sortera arkivet (nyast först)
  newsArchive.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
};

app.get('/api/news', async (req, res) => {
  const { url, id } = req.query;
  if (!url) return res.status(400).json({ error: 'URL saknas' });

  try {
    let items = [];
    if (id === 'reddit') {
      const response = await axios.get(url, { headers: { 'User-Agent': 'Startsidan2026/1.0' } });
      items = response.data.data.children.map(child => ({
        title: child.data.title,
        link: `https://reddit.com${child.data.permalink}`,
        source: `REDDIT R/${child.data.subreddit.toUpperCase()}`,
        sourceId: 'reddit',
        pubDate: new Date(child.data.created_utc * 1000).toISOString(),
        description: cleanDescription(child.data.selftext)
      }));
    } else {
      const feed = await parser.parseURL(url);
      items = feed.items.map(item => ({
        title: item.title,
        link: item.link,
        source: feed.title?.split(' - ')[0] || id.toUpperCase(),
        sourceId: id,
        pubDate: item.pubDate || item.isoDate,
        description: cleanDescription(item.contentSnippet || item.content),
        image: item.enclosure?.url || null
      }));
    }

    // Uppdatera arkivet med de nya fynden
    addToArchive(items);

    // Returnera de 25 nyaste från just denna källa för kategorivyerna
    res.json(items.slice(0, 25));

  } catch (error) {
    console.error(`[SERVER] Error för ${id}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// NY ENDPOINT: Returnera hela arkivet för rankning i frontend
app.get('/api/archive', (req, res) => {
  res.json(newsArchive);
});

app.listen(PORT, () => {
  console.log(`>>> Intelligence Server v5.0 (Archive Enabled) på http://localhost:${PORT}`);
});