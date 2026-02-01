<script setup lang="ts">
import { Settings2, Moon, Sun } from 'lucide-vue-next'
import { useHubStore } from '../stores/useHubStore'
import SearchBar from './SearchBar.vue'

const store = useHubStore()
</script>

<template>
  <div class="space-y-12 bg-paper-bg transition-colors duration-500">
    <nav class="flex flex-col md:flex-row items-start justify-between gap-12">
      
      <!-- Den nya intelligenta sökrutan -->
      <div class="flex-1 w-full">
        <SearchBar />
      </div>

      <!-- Globala Kontroller -->
      <div class="flex items-center gap-4 min-w-fit pt-2">
        <button 
          @click="store.toggleTheme"
          class="p-4 border border-paper-border hover:bg-paper-accent hover:text-white transition-all shadow-sm active:translate-y-0.5 bg-paper-surface"
          title="Växla mörkt/ljust läge"
        >
          <component :is="store.isDarkMode ? Sun : Moon" class="h-6 w-6" />
        </button>

        <button 
          @click="store.toggleSettings"
          class="flex items-center gap-3 font-black text-[11px] uppercase tracking-widest border border-paper-border px-8 py-4 hover:bg-paper-accent hover:text-white transition-all shadow-sm active:translate-y-0.5 bg-paper-surface"
        >
          <Settings2 class="h-5 w-5" />
          Anpassa Sidan
        </button>
      </div>
    </nav>

    <!-- Genvägar (Snyggare integrerade) -->
    <div v-if="store.quickLinks.length > 0" class="flex flex-wrap items-center gap-x-8 gap-y-4 px-4 py-4 border-y border-paper-border/10 bg-paper-ink/[0.02]">
      <span class="text-[9px] font-black uppercase tracking-widest text-paper-muted opacity-40">Snabbval:</span>
      <div class="flex flex-wrap gap-8">
        <a 
          v-for="link in store.quickLinks" 
          :key="link.url"
          :href="link.url"
          target="_blank"
          rel="noopener noreferrer"
          class="group flex items-center gap-3 transition-all hover:translate-y-[-2px]"
        >
          <img :src="link.favicon" class="w-5 h-5 grayscale group-hover:grayscale-0 opacity-50 group-hover:opacity-100 transition-all" alt="" />
          <span class="text-[11px] font-black uppercase tracking-wider text-paper-muted group-hover:text-paper-ink border-b-2 border-transparent group-hover:border-paper-accent transition-all">{{ link.name }}</span>
        </a>
      </div>
    </div>
  </div>
</template>
