<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import axios from 'axios'
import { Sun, Cloud, CloudRain, CloudLightning, CloudSun, MapPin } from 'lucide-vue-next'
import { useHubStore } from '../stores/useHubStore'

const store = useHubStore()
const temp = ref<number | null>(null)
const symbol = ref<number | null>(null)
const forecast = ref<{ time: string, temp: number, symbol: number }[]>([])
const loading = ref(true)

const fetchWeather = async () => {
  if (!store.userLocation) return
  
  loading.value = true
  const { lat, lon } = store.userLocation
  console.log(`[WEATHER] Hämtar väder för koordinater: ${lat.toFixed(2)}, ${lon.toFixed(2)} (${store.userLocation.city})`);
  try {
    const response = await axios.get(`https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/geotype/point/lon/${lon.toFixed(2)}/lat/${lat.toFixed(2)}/data.json`)
    const ts = response.data.timeSeries
    temp.value = ts[0].parameters.find((p: any) => p.name === 't').values[0]
    symbol.value = ts[0].parameters.find((p: any) => p.name === 'Wsymb2').values[0]
    forecast.value = ts.slice(1, 7).map((t: any) => ({
      time: new Date(t.validTime).getHours() + ':00',
      temp: t.parameters.find((p: any) => p.name === 't').values[0],
      symbol: t.parameters.find((p: any) => p.name === 'Wsymb2').values[0]
    }))
  } catch (e) { 
    console.error('Väderfel:', e) 
  } finally { 
    loading.value = false 
  }
}

const getIcon = (s: number) => {
  if (s <= 2) return Sun
  if (s <= 4) return CloudSun
  if (s <= 7) return Cloud
  if (s <= 10) return CloudRain
  if (s === 11) return CloudLightning
  return Cloud
}

const clothingAdvice = computed(() => {
  if (temp.value === null) return ''
  if (temp.value < 0) return 'Varma kläder rekommenderas.'
  if (temp.value < 10) return 'Tjock jacka behövs.'
  if (temp.value < 18) return 'En lättare jacka räcker.'
  return 'Det är varmt ute.'
})

// Hämta väder när platsen blir tillgänglig
watch(() => store.userLocation, (newLoc) => {
  if (newLoc) fetchWeather()
}, { immediate: true })

onMounted(() => {
  if (store.userLocation) fetchWeather()
})
</script>

<template>
  <div class="paper-module transition-colors duration-500">
    <div class="flex items-center justify-between mb-8 border-b border-paper-border pb-2">
      <div class="flex items-center gap-2 text-paper-muted">
        <MapPin class="h-4 w-4 text-paper-accent" />
        <span class="text-[10px] font-bold uppercase tracking-widest">{{ store.userLocation?.city || 'Söker position...' }}</span>
      </div>
      <span class="news-subline italic">Lokal Prognos</span>
    </div>
    
    <div v-if="loading" class="animate-pulse flex flex-col gap-4 py-4">
      <div class="h-16 w-full bg-paper-ink/5"></div>
      <div class="h-8 w-full bg-paper-ink/5"></div>
    </div>
    
    <div v-else class="space-y-12">
      <div class="flex items-center justify-between px-4">
        <div class="flex items-baseline gap-1">
          <span class="news-headline text-8xl leading-none tabular-nums text-paper-ink">{{ temp?.toFixed(0) }}</span>
          <span class="text-3xl font-bold text-paper-accent">°C</span>
        </div>
        <component :is="getIcon(symbol || 1)" class="h-20 w-20 text-paper-ink" />
      </div>

      <div class="grid grid-cols-6 gap-2 border-t border-paper-border pt-6">
        <div v-for="f in forecast" :key="f.time" class="flex flex-col items-center gap-2">
          <span class="text-[9px] font-black uppercase text-paper-muted">{{ f.time }}</span>
          <component :is="getIcon(f.symbol)" class="h-5 w-5 text-paper-ink opacity-40" />
          <span class="text-[11px] font-bold text-paper-ink">{{ f.temp.toFixed(0) }}°</span>
        </div>
      </div>

      <div v-if="store.isAdvancedMode" class="mt-8 p-4 border-l-2 border-paper-accent bg-paper-ink/5 italic text-sm text-paper-muted">
        {{ clothingAdvice }}
      </div>
    </div>
  </div>
</template>