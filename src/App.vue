<script setup lang="ts">
import { ref, onMounted } from 'vue'
import TopBar from './components/TopBar.vue'
import NewsPulse from './components/NewsPulse.vue'
import WeatherWidget from './components/WeatherWidget.vue'
import CalendarWidget from './components/CalendarWidget.vue'
import TodoWidget from './components/TodoWidget.vue'
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

      <!-- Main Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 mt-16 items-start">
        
        <!-- Kolumn 1: Toppnyheter & Sverige (Bred) -->
        <div class="lg:col-span-5 space-y-24">
          <!-- Den nya kurerade modulen -->
          <NewsPulse :topOnly="true" />
          
          <NewsPulse category="Sverige" />
          <NewsPulse category="Världen" />
        </div>

        <!-- Kolumn 2: Livet & Teknik (Mellan) -->
        <div class="lg:col-span-4 lg:px-10 lg:border-x lg:border-paper-border dark:lg:border-dark-border space-y-16">
          <CalendarWidget />
          <TodoWidget />
          <NewsPulse category="Teknik" />
        </div>

        <!-- Kolumn 3: Status & Reddit (Smal) -->
        <div class="lg:col-span-3 space-y-16">
          <WeatherWidget />
          <FinanceWidget />
          
          <!-- Dagens Ord -->
          <div v-if="dailyWord" class="p-8 border-4 border-paper-border italic bg-paper-surface relative group overflow-hidden shadow-[8px_8px_0px_var(--paper-border)]">
            <Quote class="absolute -right-4 -bottom-4 h-24 w-24 opacity-[0.03] rotate-12" />
            <span class="news-subline opacity-40 block mb-6 text-paper-muted">Dagens Ord</span>
            <div class="space-y-4 relative z-10">
              <h5 class="text-4xl font-black news-headline">{{ dailyWord.word }}</h5>
              <p class="text-sm font-medium leading-relaxed text-paper-muted">{{ dailyWord.meaning }}</p>
            </div>
            <div class="mt-8 pt-4 border-t border-paper-border text-[9px] font-black uppercase opacity-30 text-paper-muted">Källa: SAOL</div>
          </div>

          <NewsPulse category="Reddit" />
        </div>

      </div>

      <!-- Footer -->
      <footer class="mt-40 py-12 border-t-2 border-paper-border flex flex-col md:flex-row justify-between items-center gap-8 text-[10px] font-black uppercase tracking-[0.5em] opacity-40">
        <span>Publicerad digitalt v.2026.02</span>
        <div class="flex gap-16">
          <span>Helt anpassningsbar</span>
          <button @click="store.toggleSettings" class="hover:text-paper-accent transition-colors">Redigera Layout</button>
        </div>
      </footer>
    </main>
  </div>
</template>