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
      let sources = [...configRes.data]

      // Hämta lokal källa baserat på tvättad data
      if (userLocation.value?.county) {
        try {
          const localRes = await axios.get(`http://localhost:3001/api/config/local-source`, {
            params: { 
              county: userLocation.value.county,
              municipality: userLocation.value.municipality
            }
          })
          if (localRes.data) sources.push(localRes.data)
        } catch (e) { console.warn('Local source sync failed') }
      }

      const savedSources = JSON.parse(localStorage.getItem('newsSources') || '[]')
      newsSources.value = sources.map((s: any) => {
        const existing = savedSources.find((ls: any) => ls.id === s.id)
        return { ...s, enabled: existing ? existing.enabled : true }
      })

      const [initRes, feedRes] = await Promise.all([
        axios.get("http://localhost:3001/api/dashboard-init"),
        axios.get(`http://localhost:3001/api/feed?sources=${newsSources.value.filter(s => s.enabled).map(s => s.id).join(',')}`)
      ])

      topNews.value = initRes.data.topHeadlines.map((item: any) => ({
        ...item, pubDateFormatted: parseDate(item.pubDate), rawDate: new Date(item.pubDate)
      }))
      trends.value = initRes.data.trends || []

      allNews.value = feedRes.data.map((item: any) => {
        const sourceMeta = newsSources.value.find(s => s.id === item.sourceId)
        return {
          ...item,
          category: sourceMeta?.category || 'Övrigt',
          pubDateFormatted: parseDate(item.pubDate),
          rawDate: new Date(item.pubDate)
        }
      })
    } catch (e) { console.error('Dashboard fetch failed', e) } finally { newsLoading.value = false }
  }

  const updateLocation = async (): Promise<void> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(); return; }
      
      navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const res = await axios.get(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`)
          const addr = res.data.address
          
          const rawMuni = addr.municipality || addr.city || addr.town || addr.village || '';
          // Hårdare tvätt: Strömstads kommun -> strömstad
          const cleanedMuni = rawMuni.toLowerCase().replace(/s kommun$/, '').replace(' kommun', '').trim();
          const countyName = (addr.state || addr.province || addr.county || '').toLowerCase().replace(' län', '').trim();

          userLocation.value = {
            lat: latitude,
            lon: longitude,
            city: cleanedMuni.charAt(0).toUpperCase() + cleanedMuni.slice(1),
            municipality: cleanedMuni,
            county: countyName
          }
          
          localStorage.setItem('userLocation', JSON.stringify(userLocation.value))
          console.log(`[GEO] Plats verifierad: ${userLocation.value.city} (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`);
          await fetchDashboard()
          resolve();
        } catch (e) { console.error('Geocoding failed'); resolve(); }
      }, () => resolve(), { timeout: 10000 })
    })
  }

  onMounted(async () => {
    applyTheme()
    // Tvinga alltid en kontroll av platsen för att undvika Stockholm-buggen
    await updateLocation()
  })

  const toggleBookmark = (item: any) => {
    const idx = bookmarks.value.findIndex(b => b.link === item.link)
    if (idx === -1) bookmarks.value.push({ ...item, savedAt: Date.now() })
    else bookmarks.value.splice(idx, 1)
  }

  const applyTheme = () => {
    if (isDarkMode.value) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }

  const quickLinks = ref(JSON.parse(localStorage.getItem('quickLinks') || JSON.stringify([
    { name: 'BankID', url: 'https://www.bankid.com', favicon: 'https://www.google.com/s2/favicons?domain=bankid.com&sz=64' },
    { name: '1177', url: 'https://www.1177.se', favicon: 'https://www.google.com/s2/favicons?domain=1177.se&sz=64' },
    { name: 'Skatteverket', url: 'https://www.skatteverket.se', favicon: 'https://www.google.com/s2/favicons?domain=skatteverket.se&sz=64' },
    { name: 'Gmail', url: 'https://mail.google.com', favicon: 'https://www.google.com/s2/favicons?domain=google.com&sz=64' }
  ])))

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
