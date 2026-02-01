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
  
  const newsSources = ref<any[]>([])
  const allNews = ref<any[]>([])
  const topNews = ref<any[]>([])
  const trends = ref<string[]>([])
  const bookmarks = ref<any[]>(JSON.parse(localStorage.getItem('bookmarks') || '[]'))
  const newsLoading = ref(false)

  const parseDate = (d: any) => {
    try {
      const date = new Date(d)
      if (isNaN(date.getTime())) return 'Nyligen'
      return formatDistanceToNow(date, { addSuffix: true, locale: sv })
        .replace('tio', '10').replace('elva', '11').replace('tolv', '12')
    } catch (e) { return 'Nyligen' }
  }

  const fetchDashboard = async () => {
    newsLoading.value = true
    try {
      // 1. Hämta CONFIG
      const configRes = await axios.get("http://localhost:3001/api/config/sources")
      const savedSources = JSON.parse(localStorage.getItem('newsSources') || '[]')
      
      newsSources.value = configRes.data.map((s: any) => {
        const existing = savedSources.find((ls: any) => ls.id === s.id)
        return { ...s, enabled: existing ? existing.enabled : true }
      })

      // 2. Hämta TOPPLISTA & TRENDER
      const res = await axios.get("http://localhost:3001/api/dashboard-init")
      topNews.value = res.data.topHeadlines.map((item: any) => ({
        ...item,
        pubDateFormatted: parseDate(item.pubDate),
        rawDate: new Date(item.pubDate)
      }))
      trends.value = res.data.trends || []

      // 3. Hämta SAMLAD FEED (Senior Power!)
      const enabledSources = newsSources.value.filter((s: any) => s.enabled)
      const activeIds = enabledSources.map(s => s.id).join(',')
      
      const feedRes = await axios.get(`http://localhost:3001/api/feed?sources=${activeIds}`)
      
      allNews.value = feedRes.data.map((item: any) => {
        const sourceMeta = newsSources.value.find(s => s.id === item.sourceId)
        return {
          ...item,
          category: sourceMeta?.category || 'Övrigt',
          pubDateFormatted: parseDate(item.pubDate),
          rawDate: new Date(item.pubDate)
        }
      })
    } catch (e) { 
      console.error('Architecture Sync failed', e) 
    } finally { 
      newsLoading.value = false 
    }
  }

  const toggleBookmark = (item: any) => {
    const idx = bookmarks.value.findIndex(b => b.link === item.link)
    if (idx === -1) bookmarks.value.push({ ...item, savedAt: Date.now() })
    else bookmarks.value.splice(idx, 1)
  }

  const isBookmarked = (link: string) => bookmarks.value.some(b => b.link === link)

  const financeItems = ref(JSON.parse(localStorage.getItem('financeItems') || '[]'))
  const quickLinks = ref(JSON.parse(localStorage.getItem('quickLinks') || '[]'))

  const applyTheme = () => {
    if (isDarkMode.value) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }

  onMounted(() => {
    applyTheme()
    fetchDashboard()
  })

  watch([isDarkMode, searchEngine, newsSources, financeItems, quickLinks, bookmarks, isPanicMode, isCompactView, isAdvancedMode], () => {
    localStorage.setItem('isDarkMode', isDarkMode.value.toString())
    localStorage.setItem('searchEngine', searchEngine.value)
    localStorage.setItem('newsSources', JSON.stringify(newsSources.value))
    localStorage.setItem('financeItems', JSON.stringify(financeItems.value))
    localStorage.setItem('quickLinks', JSON.stringify(quickLinks.value))
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks.value))
    localStorage.setItem('isPanicMode', isPanicMode.value.toString())
    localStorage.setItem('isCompactView', isCompactView.value.toString())
    localStorage.setItem('isAdvancedMode', isAdvancedMode.value.toString())
    applyTheme()
  }, { deep: true })

  return {
    isDarkMode, searchEngine, newsSources, allNews, topNews, trends, bookmarks, newsLoading, financeItems, statusItems: ref([]), quickLinks, isPanicMode, isSettingsOpen, isCompactView, isAdvancedMode,
    togglePanic: () => isPanicMode.value = !isPanicMode.value,
    toggleMode: () => isAdvancedMode.value = !isAdvancedMode.value,
    toggleSettings: () => isSettingsOpen.value = !isSettingsOpen.value,
    toggleCompact: () => isCompactView.value = !isCompactView.value,
    toggleTheme: () => isDarkMode.value = !isDarkMode.value,
    toggleBookmark, isBookmarked,
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
