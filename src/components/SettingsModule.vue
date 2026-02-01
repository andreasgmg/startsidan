<script setup lang="ts">
import { ref } from 'vue'
import { useHubStore } from '../stores/useHubStore'
import { X, Trash2, Settings2, Newspaper, Link, Moon, Sun } from 'lucide-vue-next'

const store = useHubStore()
const newLinkName = ref('')
const newLinkUrl = ref('')

const handleAddLink = () => {
  if (newLinkName.value && newLinkUrl.value) {
    store.addQuickLink(newLinkName.value, newLinkUrl.value)
    newLinkName.value = ''; newLinkUrl.value = ''
  }
}
</script>

<template>
  <Transition name="fade">
    <div v-if="store.isSettingsOpen" @click="store.toggleSettings" class="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex justify-end">
      <div @click.stop class="w-full max-w-2xl bg-paper-bg h-full shadow-2xl border-l-8 border-paper-border flex flex-col transition-colors duration-500">
        <!-- Header -->
        <div class="p-10 border-b-8 border-double border-paper-border flex justify-between items-center bg-paper-ink text-paper-bg">
          <div class="flex items-center gap-6">
            <Settings2 class="h-10 w-10 opacity-80" />
            <h2 class="text-5xl news-headline italic uppercase tracking-tighter">Sättningar</h2>
          </div>
          <button @click="store.toggleSettings" class="hover:rotate-90 transition-transform"><X class="h-10 w-10" /></button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-12 space-y-20 custom-scrollbar">
          
          <!-- Tema & Visning -->
          <section>
            <div class="flex items-center gap-4 mb-8 border-b-2 border-paper-border pb-2 opacity-80">
              <span class="news-subline">Utseende</span>
            </div>
            <div class="grid grid-cols-2 gap-6">
              <button 
                @click="store.isDarkMode = false"
                class="p-6 border-2 border-paper-border flex flex-col items-center gap-4 transition-all"
                :class="!store.isDarkMode ? 'bg-paper-ink text-paper-bg shadow-[6px_6px_0px_var(--paper-border)]' : 'opacity-40'"
              >
                <Sun class="h-8 w-8" />
                <span class="text-xs font-black uppercase tracking-widest">Ljust papper</span>
              </button>
              <button 
                @click="store.isDarkMode = true"
                class="p-6 border-2 border-paper-border flex flex-col items-center gap-4 transition-all"
                :class="store.isDarkMode ? 'bg-paper-accent text-white shadow-[6px_6px_0px_var(--paper-border)] border-paper-accent' : 'opacity-40'"
              >
                <Moon class="h-8 w-8" />
                <span class="text-xs font-black uppercase tracking-widest">Nattläge</span>
              </button>
            </div>
          </section>

          <!-- Nyhetskällor -->
          <section>
            <div class="flex items-center gap-4 mb-8 border-b-2 border-paper-border pb-2 opacity-80">
              <Newspaper class="h-5 w-5" />
              <span class="news-subline">Nyhetskällor</span>
            </div>
            <div class="grid grid-cols-1 gap-4">
              <label v-for="source in store.newsSources" :key="source.id" 
                     class="flex items-center justify-between p-5 border border-paper-border cursor-pointer hover:bg-paper-ink hover:text-paper-bg transition-all group">
                <span class="text-lg font-bold italic">{{ source.name }}</span>
                <input type="checkbox" v-model="source.enabled" class="w-6 h-6 accent-paper-accent" />
              </label>
            </div>
          </section>

          <!-- Genvägar -->
          <section>
            <div class="flex items-center gap-4 mb-8 border-b-2 border-paper-border pb-2 opacity-80">
              <Link class="h-5 w-5" />
              <span class="news-subline">Genvägar</span>
            </div>
            <div class="space-y-8">
              <div class="flex flex-col md:flex-row gap-4">
                <input v-model="newLinkName" type="text" placeholder="NAMN" class="flex-1 paper-input p-2 text-sm" />
                <input v-model="newLinkUrl" type="text" placeholder="URL" class="flex-1 paper-input p-2 text-sm" />
                <button @click="handleAddLink" class="bg-paper-ink text-paper-bg px-8 py-3 font-black text-xs uppercase tracking-widest hover:bg-paper-accent transition-all shadow-[4px_4px_0px_var(--paper-border)]">Lägg till</button>
              </div>
              <div class="grid grid-cols-1 gap-3">
                <div v-for="link in store.quickLinks" :key="link.url" class="flex items-center justify-between p-4 border border-paper-border/20 bg-paper-surface/50">
                  <span class="text-sm font-bold italic tracking-tight">{{ link.name }}</span>
                  <button @click="store.removeQuickLink(link.url)" class="text-paper-accent hover:scale-125 transition-transform"><Trash2 class="h-5 w-5" /></button>
                </div>
              </div>
            </div>
          </section>

        </div>

        <div class="p-10 border-t-8 border-double border-paper-border bg-paper-ink text-paper-bg text-center italic font-bold">
          Konfigurationen lagras lokalt på din maskin.
        </div>
      </div>
    </div>
  </Transition>
</template>
