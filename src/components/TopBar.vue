<script setup lang="ts">
import { ref } from 'vue'
import { Search, Settings2, Moon, Sun, Globe, Cpu, Book, ShoppingCart, ShieldCheck } from 'lucide-vue-next'
import { useHubStore } from '../stores/useHubStore'

const store = useHubStore()
const query = ref('')

const engines = {
  google: { name: 'Google', url: 'https://www.google.com/search?q=', icon: Globe },
  duck: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=', icon: ShieldCheck },
  wiki: { name: 'Wikipedia', url: 'https://sv.wikipedia.org/wiki/Special:Sök?search=', icon: Book },
  gpt: { name: 'ChatGPT', url: 'https://chat.openai.com/?q=', icon: Cpu },
  p: { name: 'Prisjakt', url: 'https://www.prisjakt.nu/search?search=', icon: ShoppingCart }
}

const handleSearch = () => {
  const trimmed = query.value.trim()
  if (!trimmed) return

  const parts = trimmed.split(' ')
  const prefix = (parts[0] || '').toLowerCase()
  const searchTerm = parts.slice(1).join(' ')

  const prefixEngines: Record<string, string> = {
    '/g': engines.google.url,
    '/d': engines.duck.url,
    '/w': engines.wiki.url,
    '/c': engines.gpt.url,
    '/p': engines.p.url
  }

  if (prefixEngines[prefix] && searchTerm) {
    window.open(`${prefixEngines[prefix]}${encodeURIComponent(searchTerm)}`, '_blank')
  } else {
    // Om inget prefix matchar, använd den valda sökmotorn i storen
    const engine = (engines as any)[store.searchEngine] || engines.google
    window.open(`${engine.url}${encodeURIComponent(trimmed)}`, '_blank')
  }
  
  query.value = ''
}
</script>

<template>
  <div class="space-y-8 bg-paper-bg transition-colors duration-500">
    <nav class="border-b-4 border-paper-border py-6 flex flex-col md:flex-row items-center justify-between gap-8">
      <!-- Universal Search -->
      <div class="flex-1 w-full max-w-4xl relative group">
        <Search class="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-6 text-paper-ink group-focus-within:text-paper-accent transition-colors" />
        <input 
          v-model="query"
          @keydown.enter="handleSearch"
          type="text" 
          :placeholder="`Sök med ${engines[store.searchEngine as keyof typeof engines]?.name || 'Google'}...`"
          class="w-full paper-input py-4 pl-10 pr-32 text-3xl italic placeholder:text-paper-muted placeholder:opacity-50"
        />
        <!-- Engine Selector -->
        <div class="absolute right-0 top-1/2 -translate-y-1/2 flex gap-2">
          <button 
            v-for="(engine, key) in engines" 
            :key="key"
            @click="store.searchEngine = key"
            class="p-1.5 border border-paper-border transition-all hover:bg-paper-accent hover:text-white"
            :class="store.searchEngine === key ? 'bg-paper-ink text-paper-bg' : 'text-paper-muted'"
            :title="engine.name"
          >
            <component :is="engine.icon" class="h-4 w-4" />
          </button>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="flex items-center gap-4 min-w-fit">
        <button 
          @click="store.toggleTheme"
          class="p-3 border-2 border-paper-border hover:bg-paper-accent hover:text-white transition-all shadow-[4px_4px_0px_var(--paper-border)] active:shadow-none active:translate-x-1 active:translate-y-1 bg-paper-bg"
        >
          <component :is="store.isDarkMode ? Sun : Moon" class="h-5 w-5" />
        </button>

        <button 
          @click="store.toggleSettings"
          class="flex items-center gap-2 font-black text-[10px] uppercase tracking-widest border-2 border-paper-border px-6 py-3 hover:bg-paper-accent hover:text-white transition-all shadow-[4px_4px_0px_var(--paper-border)] active:shadow-none active:translate-x-1 active:translate-y-1 bg-paper-bg"
        >
          <Settings2 class="h-4 w-4" />
          Anpassa
        </button>
      </div>
    </nav>

    <!-- Quick Access Bar -->
    <div class="flex flex-wrap items-center gap-x-8 gap-y-4 px-2">
      <span class="text-[9px] font-black uppercase tracking-widest text-paper-muted italic opacity-50">Genvägar:</span>
      <div class="flex flex-wrap gap-6">
        <a 
          v-for="link in store.quickLinks" 
          :key="link.url"
          :href="link.url"
          target="_blank"
          rel="noopener noreferrer"
          class="group flex items-center gap-2 transition-all hover:translate-y-[-1px]"
        >
          <img :src="link.favicon" class="w-4 h-4 grayscale group-hover:grayscale-0 opacity-40 group-hover:opacity-100 transition-all" alt="" />
          <span class="text-[10px] font-bold uppercase tracking-wider text-paper-muted group-hover:text-paper-ink border-b border-transparent group-hover:border-paper-ink transition-all">{{ link.name }}</span>
        </a>
      </div>
    </div>
  </div>
</template>