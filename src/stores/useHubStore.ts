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
  const userLocation = ref<any>(JSON.parse(localStorage.getItem('userLocation') || 'null'))
  const newsLoading = ref(false)

  const quickLinks = ref(JSON.parse(localStorage.getItem('quickLinks') || JSON.stringify([
    { name: 'BankID', url: 'https://www.bankid.com', favicon: 'https://www.google.com/s2/favicons?domain=bankid.com&sz=64' },
    { name: '1177', url: 'https://www.1177.se', favicon: 'https://www.google.com/s2/favicons?domain=1177.se&sz=64' },
    { name: 'Skatteverket', url: 'https://www.skatteverket.se', favicon: 'https://www.google.com/s2/favicons?domain=skatteverket.se&sz=64' },
    { name: 'Gmail', url: 'https://mail.google.com', favicon: 'https://www.google.com/s2/favicons?domain=google.com&sz=64' }
  ])))

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
      const configRes = await axios.get("http://localhost:3001/api/config/sources")
      let sources = configRes.data

      if (userLocation.value && userLocation.value.county) {
        try {
          const localRes = await axios.get(`http://localhost:3001/api/config/local-source?county=${encodeURIComponent(userLocation.value.county)}`)
          sources.push(localRes.data)
        } catch (e) { console.warn('Local source fetch failed') }
      }

      const savedSources = JSON.parse(localStorage.getItem('newsSources') || '[]')
      newsSources.value = sources.map((s: any) => {
        const existing = savedSources.find((ls: any) => ls.id === s.id)
        return { ...s, enabled: existing ? existing.enabled : true }
      })

      const initRes = await axios.get("http://localhost:3001/api/dashboard-init")
      topNews.value = initRes.data.topHeadlines.map((item: any) => ({
        ...item,
        pubDateFormatted: parseDate(item.pubDate),
        rawDate: new Date(item.pubDate)
      }))
      trends.value = initRes.data.trends || []

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
    } catch (e) { console.error('Architecture Sync failed', e) } finally { newsLoading.value = false }
  }

  const updateLocation = async (): Promise<void> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve();
        return;
      }
      
      navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const res = await axios.get(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`)
          const addr = res.data.address
          const county = addr.state || addr.province || addr.county || ''
          
          // Letar igenom alla nivåer från by till kommun för att hitta ett namn
          const placeName = addr.city || addr.town || addr.municipality || addr.village || addr.hamlet || addr.suburb || addr.county || 'Din plats';
          
          userLocation.value = {
            lat: latitude,
            lon: longitude,
            city: placeName.replace(' kommun', ''),
            county: county.replace(' län', '').toLowerCase()
          }
          localStorage.setItem('userLocation', JSON.stringify(userLocation.value))
          console.log(`[GEO] Plats funnen: ${userLocation.value.city}`);
          await fetchDashboard()
          resolve();
        } catch (e) {
          console.error('Location geocoding failed')
          resolve();
        }
      }, () => resolve())
    })
  }

  const toggleBookmark = (item: any) => {
    const idx = bookmarks.value.findIndex(b => b.link === item.link)
    if (idx === -1) bookmarks.value.push({ ...item, savedAt: Date.now() })
    else bookmarks.value.splice(idx, 1)
  }

  const applyTheme = () => {
    if (isDarkMode.value) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }

  onMounted(async () => {
    applyTheme()
    // 1. Försök hämta plats först
    if (!userLocation.value) {
      await updateLocation()
    } else {
      // Om vi redan har plats i localStorage, hämta dashboard direkt
      fetchDashboard()
    }
  })

  watch([isDarkMode, searchEngine, newsSources, bookmarks, quickLinks, isPanicMode, isCompactView, isAdvancedMode], () => {
    localStorage.setItem('isDarkMode', isDarkMode.value.toString())
    localStorage.setItem('searchEngine', searchEngine.value)
    localStorage.setItem('newsSources', JSON.stringify(newsSources.value))
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks.value))
    localStorage.setItem('quickLinks', JSON.stringify(quickLinks.value))
    localStorage.setItem('isPanicMode', isPanicMode.value.toString())
    localStorage.setItem('isCompactView', isCompactView.value.toString())
    localStorage.setItem('isAdvancedMode', isAdvancedMode.value.toString())
    applyTheme()
  }, { deep: true })

  return {
    isDarkMode, searchEngine, newsSources, allNews, topNews, trends, bookmarks, userLocation, newsLoading, isPanicMode, isSettingsOpen, isCompactView, isAdvancedMode,
    financeItems: ref(JSON.parse(localStorage.getItem('financeItems') || '[]')),
    quickLinks,
    togglePanic: () => isPanicMode.value = !isPanicMode.value,
    toggleMode: () => isAdvancedMode.value = !isAdvancedMode.value,
    toggleSettings: () => isSettingsOpen.value = !isSettingsOpen.value,
    toggleCompact: () => isCompactView.value = !isCompactView.value,
    toggleTheme: () => isDarkMode.value = !isDarkMode.value,
    toggleBookmark, isBookmarked: (link: string) => bookmarks.value.some(b => b.link === link), 
    updateLocation, fetchAllNews: fetchDashboard,
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