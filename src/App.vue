<script setup lang="ts">
import { ref, onMounted } from 'vue'
import TopBar from './components/TopBar.vue'
import NewsPulse from './components/NewsPulse.vue'
import WeatherWidget from './components/WeatherWidget.vue'
import TrafficWidget from './components/TrafficWidget.vue'
import FinanceWidget from './components/FinanceWidget.vue'
import SettingsModule from './components/SettingsModule.vue'
import { useHubStore } from './stores/useHubStore'
import { Megaphone, Quote } from 'lucide-vue-next'

const store = useHubStore()

const dailyWords = [
  { word: 'Epifani', meaning: 'Plötslig insikt eller uppenbarelse.' },
  { word: 'Serendipitet', meaning: 'Oavsiktlig upptäckt, en lycklig slump.' },
  { word: 'Vederkvickelse', meaning: 'Något som ger ny styrka eller energi.' },
  { word: 'Eterisk', meaning: 'Himmelsk, ogripbar eller luftig.' },
  { word: 'Sisu', meaning: 'Uthållighet, envishet och kampvilja.' }
]

const dailyWord = ref(dailyWords[0])

onMounted(() => {
  const dayIndex = new Date().getDate() % dailyWords.length
  dailyWord.value = dailyWords[dayIndex]
})
</script>

<template>
  <div :class="{ 'dark': store.isDarkMode }">
    <main class="min-h-screen p-4 md:p-8 lg:px-12 lg:py-12 max-w-[1900px] mx-auto relative transition-colors duration-500 bg-paper-bg text-paper-ink">
      <!-- Global Settings -->
      <SettingsModule />

      <!-- Panic Mode -->
      <div v-if="store.isPanicMode" class="border-b-4 border-paper-accent py-4 mb-12 flex items-center justify-center gap-6 bg-paper-accent/5">
        <Megaphone class="h-6 w-6 text-paper-accent animate-pulse" />
        <span class="text-xl font-black uppercase italic text-paper-accent tracking-tighter text-center">Viktigt meddelande: Krisinformation har utfärdats // Kontrollera källor</span>
      </div>

      <!-- Header -->
      <header class="flex flex-col md:flex-row justify-between items-end border-b-8 border-paper-border pb-6 mb-12 gap-8">
        <div class="flex flex-col">
          <h1 class="text-8xl md:text-9xl news-headline leading-none">Startsidan<span class="text-paper-accent">.</span></h1>
          <p class="text-sm font-bold uppercase tracking-[0.4em] mt-4 opacity-60 italic">Kurerad överblick // 2026</p>
        </div>
        
        <div class="flex flex-col items-end gap-2 text-[10px] font-black uppercase tracking-widest opacity-40">
          <span>Sverige</span>
          <span>{{ new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' }) }}</span>
        </div>
      </header>

      <TopBar />

      <!-- Main Layout: Cockpit Style (80/20 Split) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-16 mt-16 items-start">
        
        <!-- MAIN COCKPIT: News Feed (approx 75%) -->
        <div class="lg:col-span-9 space-y-24">
          <!-- 1. Critical & Top Headlines (Full Width) -->
          <div class="space-y-24">
            <NewsPulse 
              v-if="store.allNews.some(n => n.category === 'Viktigt')"
              category="Viktigt" 
              title="Viktiga Meddelanden" 
            />

            <NewsPulse :topOnly="true" />
            
            <NewsPulse 
              v-if="store.selectedMunicipality || store.userLocation" 
              category="Lokalt" 
              :title="`Lokala nyheter: ${store.selectedMunicipality || store.userLocation?.city}`" 
            />
          </div>

          <!-- 2. The Daily Feed (2 Columns for density) -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-24 border-t-2 border-paper-border pt-16">
            <!-- Left Sub-col -->
            <div class="space-y-16">
              <NewsPulse category="Sverige" title="Inrikes" />
              <NewsPulse category="Världen" title="Global Utblick" />
              <NewsPulse category="Sport" title="Sport" />
            </div>

            <!-- Right Sub-col -->
            <div class="space-y-16 md:border-l md:border-paper-border md:pl-16">
              <NewsPulse category="Teknik" title="Teknik & Innovation" />
              <NewsPulse category="Vetenskap" title="Vetenskap" />
              <NewsPulse category="Spel" title="Digital Kultur" />
              <NewsPulse category="Livsstil" title="Livsstil & Nöje" />
              <NewsPulse category="Reddit" title="Reddit & Viral" />
            </div>
          </div>
        </div>

        <!-- SIDEBAR: Passive Context (Weather, Finance, Words) -->
        <div class="lg:col-span-3 space-y-16 lg:border-l-2 lg:border-paper-border lg:pl-10">
          
          <!-- Sparade Artiklar (Läs senare) -->
          <NewsPulse 
            v-if="store.bookmarks.length > 0" 
            title="Läs senare" 
            :customItems="store.bookmarks"
          />

          <WeatherWidget />
          <TrafficWidget />
          <FinanceWidget />
          
          <!-- Dagens Ord (Passive enrichment) -->
          <div v-if="dailyWord" class="p-8 border border-paper-border italic bg-paper-gold/20 dark:bg-paper-gold/5 relative group overflow-hidden shadow-sm">
            <Quote class="absolute -right-4 -bottom-4 h-24 w-24 opacity-[0.03] rotate-12" />
            <span class="news-subline opacity-40 block mb-6 text-paper-muted">Dagens Ord</span>
            <div class="space-y-4 relative z-10">
              <h5 class="text-4xl font-black news-headline">{{ dailyWord.word }}</h5>
              <p class="text-sm font-medium leading-relaxed text-paper-muted">{{ dailyWord.meaning }}</p>
            </div>
            <div class="mt-8 pt-4 border-t border-paper-border text-[9px] font-black uppercase opacity-30 text-paper-muted">Källa: SAOL</div>
          </div>
        </div>

      </div>

      <!-- Footer -->
      <footer class="mt-40 py-12 border-t-2 border-paper-border flex flex-col md:flex-row justify-between items-center gap-8 text-[10px] font-black uppercase tracking-[0.5em] opacity-40">
        <span>Publicerad digitalt v.2026.02</span>
        <div class="flex gap-16">
          <span>Omvärldskoll utan distraktioner</span>
          <button @click="store.toggleSettings" class="hover:text-paper-accent transition-colors">Redigera Källor</button>
        </div>
      </footer>
    </main>
  </div>
</template>