<script setup lang="ts">
import { ref, watch } from 'vue'
import { Search, Flame, Globe, ArrowRight, X } from 'lucide-vue-next'
import { useHubStore } from '../stores/useHubStore'
import axios from 'axios'

const store = useHubStore()
const query = ref('')
const searchResults = ref<any[]>([])
const isSearching = ref(false)

// Sök i arkivet automatiskt när man skriver
watch(query, async (newQuery) => {
  if (newQuery.length < 2) {
    searchResults.value = []
    isSearching.value = false
    return
  }

  isSearching.value = true
  try {
    const res = await axios.get(`http://localhost:3001/api/search?q=${encodeURIComponent(newQuery)}`)
    searchResults.value = res.data
  } catch (e) {
    console.error('Arkivsök misslyckades')
  } finally {
    isSearching.value = false
  }
})

const searchExternal = (engine: string) => {
  const engines: Record<string, string> = {
    google: 'https://www.google.com/search?q=',
    duckduckgo: 'https://duckduckgo.com/?q=',
    chatgpt: 'https://chat.openai.com/?q='
  }
  window.open(engines[engine] + encodeURIComponent(query.value), '_blank')
}

const selectTrend = (trend: string) => {
  query.value = trend
}

const clearSearch = () => {
  query.value = ''
  searchResults.value = []
}
</script>

<template>
  <div class="relative w-full max-w-5xl space-y-6">
    <!-- Search Input -->
    <div class="relative group">
      <div class="absolute inset-y-0 left-6 flex items-center pointer-events-none">
        <Search class="h-6 w-6 text-paper-ink opacity-20 group-focus-within:opacity-100 transition-opacity" />
      </div>
      <input 
        v-model="query"
        type="text" 
        placeholder="Sök i arkivet (t.ex. 'Räntan' eller 'Nvidia')..."
        class="w-full bg-paper-surface py-6 pl-16 pr-8 text-2xl font-medium focus:outline-none neo-subtle placeholder:opacity-30 placeholder:italic"
      />
      <button 
        v-if="query" 
        @click="clearSearch"
        class="absolute inset-y-0 right-6 flex items-center text-paper-ink opacity-40 hover:opacity-100"
      >
        <X class="h-6 w-6" />
      </button>
    </div>

    <!-- Trend Barometer -->
    <div v-if="store.trends.length > 0" class="flex flex-wrap items-center gap-3 px-2 relative z-10">
      <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-paper-accent">
        <Flame class="h-4 w-4" />
        Analys trendar just nu:
      </div>
      <button 
        v-for="trend in store.trends" 
        :key="trend"
        @click="selectTrend(trend)"
        class="px-4 py-1.5 bg-paper-ink text-paper-bg hover:bg-paper-accent hover:text-white rounded-none text-[11px] font-bold transition-all uppercase tracking-wider neo-tag hover:-translate-y-0.5 active:translate-y-0"
      >
        {{ trend }}
      </button>
    </div>

    <!-- Live Search Results (Panel) -->
    <div v-if="query.length >= 2" class="absolute z-[200] w-full mt-4 bg-paper-surface border-2 border-paper-ink p-10 shadow-2xl overflow-hidden rounded-none left-0 right-0">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-16">
        <!-- Arkiv-träffar -->
        <div class="lg:col-span-2 space-y-8">
          <div class="flex justify-between items-center border-b-2 border-paper-border pb-6">
            <h3 class="news-headline text-4xl">Träffar i arkivet</h3>
            <span class="text-xs font-black uppercase opacity-40 tracking-widest">{{ searchResults.length }} resultat</span>
          </div>
          
          <div v-if="searchResults.length === 0 && !isSearching" class="py-20 text-center">
            <p class="text-lg italic opacity-40">Inga artiklar hittades i arkivet under de senaste 48 timmarna.</p>
          </div>

          <div class="space-y-10 max-h-[60vh] overflow-y-auto pr-6 custom-scrollbar">
            <a v-for="item in searchResults" :key="item.link" :href="item.link" target="_blank" class="block group border-b border-paper-border/10 pb-6 last:border-0 transition-all hover:translate-x-2">
              <div class="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">
                <span class="text-paper-accent">{{ item.sourceName || item.source }}</span>
                <span>{{ item.pubDate }}</span>
              </div>
              <h4 class="text-2xl news-headline group-hover:text-paper-accent transition-colors leading-tight">{{ item.title }}</h4>
            </a>
          </div>
        </div>

        <!-- Externa Val -->
        <div class="space-y-10 border-l border-paper-border/20 pl-12">
          <h3 class="news-headline text-3xl">Vidare sökning</h3>
          <div class="space-y-4">
            <button @click="searchExternal('google')" class="w-full flex items-center justify-between p-5 bg-blue-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-xl hover:bg-blue-700 transition-all shadow-lg">
              Google Sök
              <Globe class="h-5 w-5" />
            </button>
            <button @click="searchExternal('duckduckgo')" class="w-full flex items-center justify-between p-5 bg-orange-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-xl hover:bg-orange-700 transition-all shadow-lg">
              DuckDuckGo
              <ArrowRight class="h-5 w-5" />
            </button>
            <button @click="searchExternal('chatgpt')" class="w-full flex items-center justify-between p-5 bg-emerald-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-xl hover:bg-emerald-700 transition-all shadow-lg">
              AI Analys
              <Search class="h-5 w-5" />
            </button>
          </div>
          <div class="pt-10 border-t border-paper-border">
            <p class="text-[11px] leading-relaxed opacity-50 italic">
              Vårt arkiv scannar kontinuerligt av världens största nyhetsbyråer för att ge dig blixtsnabb åtkomst utan reklam eller spårning.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: var(--paper-border); border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--paper-accent); }
</style>
