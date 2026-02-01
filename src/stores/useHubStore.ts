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
  
  const defaultSources = [
    { id: 'svt', name: 'SVT Nyheter', enabled: true, url: 'https://www.svt.se/nyheter/rss.xml', category: 'Sverige', weight: 100 },
    { id: 'dn', name: 'Dagens Nyheter', enabled: true, url: 'https://www.dn.se/rss/nyheter/', category: 'Sverige', weight: 90 },
    { id: 'svd', name: 'SvD', enabled: true, url: 'https://www.svd.se/?service=rss', category: 'Sverige', weight: 90 },
    { id: 'bbc', name: 'BBC World', enabled: true, url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'Världen', weight: 95 },
    { id: 'nyt', name: 'NY Times', enabled: true, url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', category: 'Världen', weight: 90 },
    { id: 'npr', name: 'NPR News', enabled: true, url: 'https://feeds.npr.org/1001/rss.xml', category: 'Världen', weight: 95 },
    { id: 'aljazeera', name: 'Al Jazeera', enabled: true, url: 'https://www.aljazeera.com/xml/rss/all.xml', category: 'Världen', weight: 85 },
    { id: 'tech', name: 'TechCrunch', enabled: true, url: 'https://techcrunch.com/feed/', category: 'Teknik', weight: 60 },
    { id: 'sc', name: 'SweClockers', enabled: true, url: 'https://www.sweclockers.com/feeds/nyheter', category: 'Teknik', weight: 60 },
    { id: 'nasa', name: 'NASA', enabled: true, url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', category: 'Vetenskap', weight: 50 },
    { id: 'forsk', name: 'Forskning.se', enabled: true, url: 'https://www.forskning.se/feed/', category: 'Vetenskap', weight: 50 },
    { id: 'fz', name: 'FZ.se', enabled: true, url: 'https://www.fz.se/feeds/nyheter', category: 'Spel', weight: 40 },
    { id: 'svtsport', name: 'SVT Sport', enabled: true, url: 'https://www.svt.se/sport/rss.xml', category: 'Sport', weight: 70 },
    { id: 'svtkultur', name: 'SVT Kultur', enabled: true, url: 'https://www.svt.se/kultur/rss.xml', category: 'Livsstil', weight: 60 },
    { id: 'reddit', name: 'Reddit Popular', enabled: true, url: 'https://www.reddit.com/r/popular/top.json?t=day&limit=15', category: 'Reddit', weight: 30 }
  ]

  const newsSources = ref(JSON.parse(localStorage.getItem('newsSources') || JSON.stringify(defaultSources)))

  // Migration logic
  newsSources.value = defaultSources.map(def => {
    const existing = newsSources.value.find((s: any) => s.id === def.id)
    return existing ? { ...existing, category: def.category, url: def.url, weight: def.weight } : def
  })

  const allNews = ref<any[]>([])
  const topNews = ref<any[]>([])
  const newsLoading = ref(false)

  const parseDate = (d: any) => {
    try {
      const date = new Date(d)
      return formatDistanceToNow(date, { addSuffix: true, locale: sv })
        .replace('tio', '10').replace('elva', '11').replace('tolv', '12')
    } catch (e) { return 'Nyligen' }
  }

  const fetchDashboard = async () => {
    newsLoading.value = true
    try {
      const res = await axios.get("http://localhost:3001/api/dashboard-init")
      topNews.value = res.data.topHeadlines.map((item: any) => ({
        ...item,
        pubDateFormatted: parseDate(item.pubDate),
        rawDate: new Date(item.pubDate)
      }))

      const proxyUrl = "http://localhost:3001/api/news"
      const enabledSources = newsSources.value.filter((s: any) => s.enabled)
      
      const results = await Promise.allSettled(enabledSources.map((s: any) => 
        axios.get(proxyUrl, { params: { id: s.id } })
      ))

      const combined: any[] = []
      results.forEach((res, idx) => {
        if (res.status === 'fulfilled') {
          const source = enabledSources[idx]
          res.value.data.forEach((item: any) => {
            combined.push({
              ...item,
              category: source.category,
              pubDateFormatted: parseDate(item.pubDate),
              rawDate: new Date(item.pubDate)
            })
          })
        }
      })
      allNews.value = combined.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime())
    } catch (e) { console.error('Dashboard sync failed', e) } finally { newsLoading.value = false }
  }

  const financeItems = ref(JSON.parse(localStorage.getItem('financeItems') || JSON.stringify([
    { id: 'el', name: 'Elpris (SE3)', enabled: true, value: '42.5', unit: 'öre' },
    { id: 'ben', name: 'Bensin (95)', enabled: true, value: '17.84', unit: 'kr' },
    { id: 'rate', name: 'Styrränta', enabled: true, value: '3.25', unit: '%' },
    { id: 'usd', name: 'USD/SEK', enabled: true, value: '10.45', unit: 'kr' }
  ])))

  const quickLinks = ref(JSON.parse(localStorage.getItem('quickLinks') || JSON.stringify([
    { name: 'BankID', url: 'https://www.bankid.com', favicon: 'https://www.google.com/s2/favicons?domain=bankid.com&sz=64' },
    { name: '1177', url: 'https://www.1177.se', favicon: 'https://www.google.com/s2/favicons?domain=1177.se&sz=64' },
    { name: 'Skatteverket', url: 'https://www.skatteverket.se', favicon: 'https://www.google.com/s2/favicons?domain=skatteverket.se&sz=64' },
    { name: 'Gmail', url: 'https://mail.google.com', favicon: 'https://www.google.com/s2/favicons?domain=google.com&sz=64' }
  ])))

  const applyTheme = () => {
    if (isDarkMode.value) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }

  onMounted(() => {
    applyTheme()
    fetchDashboard()
  })

  watch([isDarkMode, searchEngine, newsSources, financeItems, quickLinks, isPanicMode, isCompactView, isAdvancedMode], () => {
    localStorage.setItem('isDarkMode', isDarkMode.value.toString())
    localStorage.setItem('searchEngine', searchEngine.value)
    localStorage.setItem('newsSources', JSON.stringify(newsSources.value))
    localStorage.setItem('financeItems', JSON.stringify(financeItems.value))
    localStorage.setItem('quickLinks', JSON.stringify(quickLinks.value))
    localStorage.setItem('isPanicMode', isPanicMode.value.toString())
    localStorage.setItem('isCompactView', isCompactView.value.toString())
    localStorage.setItem('isAdvancedMode', isAdvancedMode.value.toString())
    applyTheme()
  }, { deep: true })

  return {
    isDarkMode, searchEngine, newsSources, allNews, topNews, newsLoading, financeItems, statusItems: ref([]), quickLinks, isPanicMode, isSettingsOpen, isCompactView, isAdvancedMode,
    togglePanic: () => isPanicMode.value = !isPanicMode.value,
    toggleMode: () => isAdvancedMode.value = !isAdvancedMode.value,
    toggleSettings: () => isSettingsOpen.value = !isSettingsOpen.value,
    toggleCompact: () => isCompactView.value = !isCompactView.value,
    toggleTheme: () => isDarkMode.value = !isDarkMode.value,
    fetchAllNews: fetchDashboard,
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