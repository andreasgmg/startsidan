import { defineStore } from 'pinia'
import { ref, watch, onMounted, computed } from 'vue'
import axios from 'axios'
import { isAfter, subHours, differenceInMinutes } from 'date-fns'

export const useHubStore = defineStore('hub', () => {
  const isDarkMode = ref(localStorage.getItem('isDarkMode') === 'true')
  const searchEngine = ref(localStorage.getItem('searchEngine') || 'google')
  const isCompactView = ref(localStorage.getItem('isCompactView') === 'true')
  const isPanicMode = ref(localStorage.getItem('isPanicMode') === 'true')
  const isAdvancedMode = ref(localStorage.getItem('isAdvancedMode') === 'true')
  const isSettingsOpen = ref(false)
  
  const defaultSources = [
    { id: 'svt', name: 'SVT Nyheter', enabled: true, url: 'https://www.svt.se/nyheter/rss.xml', category: 'Sverige', weight: 100 },
    { id: 'dn', name: 'Dagens Nyheter', enabled: true, url: 'https://www.dn.se/rss/nyheter/', category: 'Sverige', weight: 95 },
    { id: 'svd', name: 'SvD', enabled: true, url: 'https://www.svd.se/?service=rss', category: 'Sverige', weight: 95 },
    { id: 'bbc', name: 'BBC World', enabled: true, url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'Världen', weight: 95 },
    { id: 'reuters', name: 'Reuters', enabled: true, url: 'https://www.reuters.com/world/rss', category: 'Världen', weight: 100 },
    { id: 'ap', name: 'Assoc. Press', enabled: true, url: 'https://newsatme.com/ap-news-rss-feed/', category: 'Världen', weight: 100 },
    { id: 'nyt', name: 'NY Times', enabled: true, url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', category: 'Världen', weight: 90 },
    { id: 'aljazeera', name: 'Al Jazeera', enabled: true, url: 'https://www.aljazeera.com/xml/rss/all.xml', category: 'Världen', weight: 85 },
    { id: 'tech', name: 'TechCrunch', enabled: true, url: 'https://techcrunch.com/feed/', category: 'Teknik', weight: 60 },
    { id: 'sc', name: 'SweClockers', enabled: true, url: 'https://www.sweclockers.com/feeds/nyheter', category: 'Teknik', weight: 60 },
    { id: 'reddit', name: 'Reddit Popular', enabled: true, url: 'https://www.reddit.com/r/popular/top.json?t=day&limit=15', category: 'Reddit', weight: 30 }
  ]

  const newsSources = ref(JSON.parse(localStorage.getItem('newsSources') || JSON.stringify(defaultSources)))
  const allNews = ref<any[]>([])
  const newsLoading = ref(false)

  // Ekonomi
  const financeItems = ref(JSON.parse(localStorage.getItem('financeItems') || JSON.stringify([
    { id: 'el', name: 'Elpris (SE3)', enabled: true, value: '42.5', unit: 'öre' },
    { id: 'ben', name: 'Bensin (95)', enabled: true, value: '17.84', unit: 'kr' },
    { id: 'rate', name: 'Styrränta', enabled: true, value: '3.25', unit: '%' },
    { id: 'usd', name: 'USD/SEK', enabled: true, value: '10.45', unit: 'kr' }
  ])))

  // Genvägar
  const quickLinks = ref(JSON.parse(localStorage.getItem('quickLinks') || JSON.stringify([
    { name: 'BankID', url: 'https://www.bankid.com', favicon: 'https://www.google.com/s2/favicons?domain=bankid.com&sz=64' },
    { name: '1177', url: 'https://www.1177.se', favicon: 'https://www.google.com/s2/favicons?domain=1177.se&sz=64' },
    { name: 'Skatteverket', url: 'https://www.skatteverket.se', favicon: 'https://www.google.com/s2/favicons?domain=skatteverket.se&sz=64' },
    { name: 'Gmail', url: 'https://mail.google.com', favicon: 'https://www.google.com/s2/favicons?domain=google.com&sz=64' }
  ])))

  const fetchAllNews = async () => {
    newsLoading.value = true
    const proxyUrl = "http://localhost:3001/api/news"
    const archiveUrl = "http://localhost:3001/api/archive"

    try {
      const enabledSources = newsSources.value.filter((s: any) => s.enabled)
      await Promise.allSettled(enabledSources.map((s: any) => axios.get(proxyUrl, { params: { url: s.url, id: s.id } })))
      
      const res = await axios.get(archiveUrl)
      allNews.value = res.data.map((item: any) => {
        const sourceMeta = newsSources.value.find((s: any) => s.id === item.sourceId)
        return {
          ...item,
          category: sourceMeta?.category || 'Övrigt',
          sourceWeight: sourceMeta?.weight || 50,
          rawDate: new Date(item.pubDate)
        }
      })
    } catch (e) { console.error('News fetch error') } finally { newsLoading.value = false }
  }

  const topNews = computed(() => {
    const dayAgo = subHours(new Date(), 24)
    const breakingKeywords = ['breaking', 'extra', 'just nu', 'larm', 'direkt', 'akut']
    
    const scoredNews = allNews.value
      .filter(item => isAfter(item.rawDate, dayAgo))
      .map(item => ({ ...item, importanceScore: item.sourceWeight || 50 }))

    scoredNews.forEach((item, idx) => {
      const normalizedTitle = item.title.toLowerCase().replace(/[^a-z0-9]/g, '')
      scoredNews.forEach((other, oIdx) => {
        if (idx === oIdx) return
        const otherNormalized = other.title.toLowerCase().replace(/[^a-z0-9]/g, '')
        if ((normalizedTitle.includes(otherNormalized) || otherNormalized.includes(normalizedTitle)) && 
            Math.abs(differenceInMinutes(item.rawDate, other.rawDate)) < 240) {
          item.importanceScore += 150
        }
      })
      if (breakingKeywords.some(key => item.title.toLowerCase().includes(key))) item.importanceScore += 80
      const hoursOld = (new Date().getTime() - item.rawDate.getTime()) / (1000 * 60 * 60)
      item.importanceScore -= (hoursOld * 1.5)
    })

    const sorted = scoredNews.sort((a, b) => b.importanceScore - a.importanceScore)
    const finalTop: any[] = []
    const seenTitles = new Set<string>()
    const sourceCount: Record<string, number> = {}

    for (const item of sorted) {
      if (finalTop.length >= 5) break
      const normalized = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40)
      const sId = item.sourceId || 'unknown'
      if (!seenTitles.has(normalized)) {
        if ((sourceCount[sId] || 0) < 1 || item.importanceScore > 200) {
          finalTop.push(item)
          seenTitles.add(normalized)
          sourceCount[sId] = (sourceCount[sId] || 0) + 1
        }
      }
    }
    return finalTop
  })

  const applyTheme = () => {
    if (isDarkMode.value) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }

  onMounted(() => {
    applyTheme()
    fetchAllNews()
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
