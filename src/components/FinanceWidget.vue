<script setup lang="ts">
import { ref } from 'vue'
import { TrendingUp, Calculator, X } from 'lucide-vue-next'
import { useHubStore } from '../stores/useHubStore'

const store = useHubStore()
const showConverter = ref(false)
const converterAmount = ref(1)
const selectedRate = ref<any>(null)

const openConverter = (item: any) => {
  selectedRate.value = item
  showConverter.value = true
}
</script>

<template>
  <div class="space-y-12 transition-colors duration-500">
    <!-- Ekonomi -->
    <div v-if="store.financeItems.some((i: any) => i.enabled)" class="paper-module">
      <div class="flex items-center justify-between mb-8 border-b border-paper-border pb-2 opacity-80">
        <div class="flex items-center gap-2 text-paper-ink">
          <TrendingUp class="h-4 w-4 text-paper-accent" />
          <span class="news-subline italic">Ekonomi</span>
        </div>
        <span class="text-[9px] font-black uppercase text-paper-muted">Realtidsdata</span>
      </div>
      <div class="space-y-8">
        <template v-for="item in store.financeItems" :key="item.id">
          <div 
            v-if="item.enabled" 
            @click="openConverter(item)"
            class="flex justify-between items-baseline cursor-pointer group border-b border-paper-border/10 pb-3 hover:border-paper-accent transition-all"
          >
            <span class="text-[11px] font-bold uppercase tracking-widest text-paper-muted group-hover:text-paper-ink">{{ item.name }}</span>
            <div class="flex items-baseline gap-1">
              <span class="news-headline text-4xl tabular-nums text-paper-ink group-hover:text-paper-accent transition-colors">{{ item.value }}</span>
              <span class="text-[10px] font-black italic text-paper-muted">{{ item.unit }}</span>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Valutaomvandlare -->
    <div v-if="showConverter" class="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" @click="showConverter = false">
      <div class="paper-module-thick bg-paper-bg text-paper-ink w-full max-w-sm p-10 shadow-2xl border-4 border-paper-border" @click.stop>
        <div class="flex justify-between items-center mb-10 border-b-2 border-paper-border pb-4">
          <div class="flex items-center gap-2">
            <Calculator class="h-6 w-6 text-paper-accent" />
            <span class="news-subline">Snabbkollen</span>
          </div>
          <button @click="showConverter = false" class="hover:rotate-90 transition-transform"><X class="h-8 w-8" /></button>
        </div>
        <div class="space-y-8">
          <div class="flex flex-col gap-3">
            <label class="text-[10px] font-bold uppercase opacity-40 tracking-[0.2em]">Enheter ({{ selectedRate?.name }})</label>
            <input v-model="converterAmount" type="number" class="paper-input text-5xl w-full py-4 font-black italic tabular-nums border-b-4" />
          </div>
          <div class="pt-8 border-t-2 border-paper-border flex flex-col gap-2">
            <span class="text-[10px] font-bold uppercase opacity-40 tracking-[0.2em]">Resultat i SEK</span>
            <span class="text-6xl font-black italic tracking-tighter tabular-nums text-paper-accent">
              {{ (converterAmount * parseFloat(selectedRate?.value)).toFixed(2) }} <span class="text-2xl text-paper-ink">kr</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>