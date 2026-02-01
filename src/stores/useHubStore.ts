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
  
  const newsSources = ref(JSON.parse(localStorage.getItem('newsSources') || '[]'))
  const allNews = ref<any[]>([])
  const topNews = ref<any[]>([])
  const newsLoading = ref(false)

  const parseDate = (d: any) => {
    try {
      const date = new Date(d)
      if (isNaN(date.getTime())) return 'Nyligen'
      return formatDistanceToNow(date, { addSuffix: true, locale: sv })
        .replace('tio', '10').replace('elva', '11').replace('tolv', '12')
    } catch (e) { return 'Nyligen' }
  }

  // --- NY OPTIMERAD DASHBOARD INIT ---
  const fetchDashboard = async (retryCount = 0) => {
    newsLoading.value = true
    try {
      const res = await axios.get("http://localhost:3001/api/dashboard-init")
      
      if (res.data.topHeadlines.length === 0 && retryCount < 3) {
        console.log("Toppnyheter fortfarande tomma, försöker igen om 3 sekunder...");
        setTimeout(() => fetchDashboard(retryCount + 1), 3000);
        return;
      }

      topNews.value = res.data.topHeadlines.map((item: any) => ({
        ...item,
        pubDateFormatted: parseDate(item.pubDate),
        rawDate: new Date(item.pubDate)
      }))

      // 2. Hämta kategoriserade nyheter i bakgrunden
      const proxyUrl = "http://localhost:3001/api/news"
      const enabledSources = newsSources.value.filter((s: any) => s.enabled)
      
      const results = await Promise.allSettled(enabledSources.map((s: any) => 
        axios.get(proxyUrl, { params: { url: s.url, id: s.id } })
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
      allNews.value = combined

    } catch (e) { 
      console.error('MX Dashboard sync failed', e) 
    } finally { 
      newsLoading.value = false 
    }
  }

  // Persistenta items
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
    fetchAllNews: fetchDashboard, // Alias för bakåtkompatibilitet
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
