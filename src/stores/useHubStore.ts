import { defineStore } from 'pinia'
import { ref, watch, onMounted } from 'vue'
import axios from 'axios'
import { formatDistanceToNow } from 'date-fns'
import { sv } from 'date-fns/locale'

export const useHubStore = defineStore('hub', () => {
  const isDarkMode = ref(localStorage.getItem('isDarkMode') === 'true')
  const searchEngine = ref(localStorage.getItem('searchEngine') || 'google')
  const isCompactView = ref(localStorage.getItem('isCompactView') === 'true')
  const isPanicMode = ref(localStorage.getItem('isPanicMode') === 'true')
  const isAdvancedMode = ref(localStorage.getItem('isAdvancedMode') === 'true')
  const isSettingsOpen = ref(false)
  
  const newsSources = ref(JSON.parse(localStorage.getItem('newsSources') || JSON.stringify([
    { id: 'svt', name: 'SVT Nyheter', enabled: true, url: 'https://www.svt.se/nyheter/rss.xml', category: 'Sverige' },
    { id: 'dn', name: 'Dagens Nyheter', enabled: true, url: 'https://www.dn.se/rss/nyheter/', category: 'Sverige' },
    { id: 'svd', name: 'SvD', enabled: true, url: 'https://www.svd.se/?service=rss', category: 'Sverige' },
    { id: 'bbc', name: 'BBC World', enabled: true, url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'Världen' },
    { id: 'nyt', name: 'NY Times', enabled: true, url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', category: 'Världen' },
    { id: 'reuters', name: 'Reuters', enabled: true, url: 'https://www.reuters.com/world/rss', category: 'Världen' },
    { id: 'aljazeera', name: 'Al Jazeera', enabled: true, url: 'https://www.aljazeera.com/xml/rss/all.xml', category: 'Världen' },
    { id: 'tech', name: 'TechCrunch', enabled: true, url: 'https://techcrunch.com/feed/', category: 'Teknik' },
    { id: 'sc', name: 'SweClockers', enabled: true, url: 'https://www.sweclockers.com/feeds/nyheter', category: 'Teknik' },
    { id: 'reddit', name: 'Reddit Popular', enabled: true, url: 'https://www.reddit.com/r/popular/top.json?t=day&limit=15', category: 'Reddit' }
  ])))

  const allNews = ref<any[]>([])
  const newsLoading = ref(false)

  const fetchAllNews = async () => {
    const enabledSources = newsSources.value.filter((s: any) => s.enabled)
    if (enabledSources.length === 0) {
      allNews.value = []
      return
    }
    
    newsLoading.value = true
    
    // Vi använder en ren CORS-proxy för att hämta RÅ XML
    const proxy = "https://corsproxy.io/?"

    const promises = enabledSources.map(async (source: any) => {
      try {
        const fetchUrl = source.id === 'reddit' ? source.url : `${proxy}${encodeURIComponent(source.url)}`
        const res = await axios.get(fetchUrl, { 
          timeout: 12000,
          responseType: source.id === 'reddit' ? 'json' : 'text' 
        })
        
        const parseDate = (d: any) => {
          try {
            const date = new Date(d)
            if (isNaN(date.getTime())) return 'Nyligen'
            return formatDistanceToNow(date, { addSuffix: true, locale: sv })
              .replace('tio', '10').replace('elva', '11').replace('tolv', '12')
          } catch (e) { return 'Nyligen' }
        }

        // 1. Hantera Reddit (JSON)
        if (source.id === 'reddit') {
          const data = res.data
          return data.data.children.map((child: any) => ({
            title: child.data.title,
            link: `https://reddit.com${child.data.permalink}`,
            source: `REDDIT R/${child.data.subreddit.toUpperCase()}`,
            sourceId: 'reddit',
            category: 'Reddit',
            pubDate: parseDate(child.data.created_utc * 1000),
            description: child.data.selftext || 'Diskussion på Reddit.'
          }))
        } 
        
        // 2. Hantera RSS (XML) - Vi tolkar XML direkt
        const parser = new DOMParser()
        const xml = parser.parseFromString(res.data, "text/xml")
        const items = Array.from(xml.querySelectorAll("item")).slice(0, 10)

        return items.map(el => {
          return {
            title: el.querySelector("title")?.textContent || "",
            link: el.querySelector("link")?.textContent || "",
            source: source.name,
            sourceId: source.id,
            category: source.category,
            pubDate: parseDate(el.querySelector("pubDate")?.textContent || ""),
            description: (el.querySelector("description")?.textContent || "").replace(/<[^>]*>/g, '').slice(0, 300)
          }
        })
      } catch (e) {
        console.error(`Källa misslyckades: ${source.name}`, e)
        return []
      }
    })

    const results = await Promise.allSettled(promises)
    const combined: any[] = []
    
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        combined.push(...result.value)
      }
    })

    allNews.value = combined
    newsLoading.value = false
  }

  // Persistenta data...
  const financeItems = ref(JSON.parse(localStorage.getItem('financeItems') || JSON.stringify([
    { id: 'el', name: 'Elpris (SE3)', enabled: true, value: '42.5', unit: 'öre' },
    { id: 'ben', name: 'Bensin (95)', enabled: true, value: '17.84', unit: 'kr' },
    { id: 'rate', name: 'Styrränta', enabled: true, value: '3.25', unit: '%' },
    { id: 'usd', name: 'USD/SEK', enabled: true, value: '10.45', unit: 'kr' }
  ])))

  const statusItems = ref(JSON.parse(localStorage.getItem('statusItems') || JSON.stringify([
    { id: 'bankid', name: 'BankID', enabled: true, status: 'OK' },
    { id: 'swish', name: 'Swish', enabled: true, status: 'OK' }
  ])))

  const quickLinks = ref(JSON.parse(localStorage.getItem('quickLinks') || JSON.stringify([
    { name: 'BankID', url: 'https://www.bankid.com' },
    { name: '1177', url: 'https://www.1177.se' },
    { name: 'Skatteverket', url: 'https://www.skatteverket.se' },
    { name: 'Gmail', url: 'https://mail.google.com' }
  ])))

  const applyTheme = () => {
    if (isDarkMode.value) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }

  onMounted(() => {
    applyTheme()
    fetchAllNews()
  })

  watch([isDarkMode, searchEngine, newsSources, financeItems, statusItems, quickLinks, isPanicMode, isCompactView, isAdvancedMode], () => {
    localStorage.setItem('isDarkMode', isDarkMode.value.toString())
    localStorage.setItem('searchEngine', searchEngine.value)
    localStorage.setItem('newsSources', JSON.stringify(newsSources.value))
    localStorage.setItem('financeItems', JSON.stringify(financeItems.value))
    localStorage.setItem('statusItems', JSON.stringify(statusItems.value))
    localStorage.setItem('quickLinks', JSON.stringify(quickLinks.value))
    localStorage.setItem('isPanicMode', isPanicMode.value.toString())
    localStorage.setItem('isCompactView', isCompactView.value.toString())
    localStorage.setItem('isAdvancedMode', isAdvancedMode.value.toString())
    applyTheme()
  }, { deep: true })

  return {
    isDarkMode, searchEngine, newsSources, allNews, newsLoading, financeItems, statusItems, quickLinks, isPanicMode, isSettingsOpen, isCompactView, isAdvancedMode,
    togglePanic: () => isPanicMode.value = !isPanicMode.value,
    toggleMode: () => isAdvancedMode.value = !isAdvancedMode.value,
    toggleSettings: () => isSettingsOpen.value = !isSettingsOpen.value,
    toggleCompact: () => isCompactView.value = !isCompactView.value,
    toggleTheme: () => isDarkMode.value = !isDarkMode.value,
    fetchAllNews,
    addQuickLink: (name: string, url: string) => {
      const domain = new URL(url.startsWith('http') ? url : 'https://' + url).hostname
      const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
      quickLinks.value.push({ name, url, favicon })
    },
    removeQuickLink: (url: string) => {
      quickLinks.value = quickLinks.value.filter((l: any) => l.url !== url)
    }
  }
})