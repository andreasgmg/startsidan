<script setup lang="ts">
import { computed } from 'vue'
import { useHubStore } from '../stores/useHubStore'

const props = defineProps<{
  category?: string
}>()

const store = useHubStore()

interface NewsItem {
  title: string
  link: string
  source: string
  pubDate: string
  description?: string
  sourceId: string
  category: string
}

const getDomain = (url: string) => {
  try {
    return new URL(url).hostname
  } catch (e) {
    return ''
  }
}

const filteredNews = computed(() => {
  if (!store.allNews || store.allNews.length === 0) return []
  
  const allItems = store.allNews as NewsItem[]
  const categoryItems = props.category 
    ? allItems.filter(item => item.category === props.category)
    : allItems

  const seenTitles = new Set<string>()
  return categoryItems.filter(item => {
    const normalized = item.title.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (seenTitles.has(normalized)) return false
    seenTitles.add(normalized)
    return true
  })
})
</script>

<template>
  <div class="space-y-8">
    <div class="flex items-center gap-4 border-b-2 border-paper-border pb-2 opacity-80">
      <span class="news-subline italic text-paper-accent !text-sm">{{ props.category || 'Nyhetsflöde' }}</span>
      <div class="h-[1px] flex-1 bg-paper-border opacity-20"></div>
    </div>
    
    <div v-if="store.newsLoading" class="space-y-8">
      <div v-for="i in 3" :key="i" class="animate-pulse space-y-4">
        <div class="h-4 w-1/4 bg-paper-border opacity-10 rounded"></div>
        <div class="h-10 w-full bg-paper-border opacity-10 rounded"></div>
      </div>
    </div>

    <div v-else-if="filteredNews.length === 0" class="py-12 text-center border-2 border-dotted border-paper-border opacity-20">
      <p class="text-sm italic">Söker efter uppdateringar...</p>
    </div>

    <div v-else class="space-y-12">
      <a v-for="(item, idx) in filteredNews" :key="item.link" :href="item.link" target="_blank" rel="noopener noreferrer" 
         class="group block border-b border-paper-border/10 pb-8 last:border-0 transition-all hover:translate-x-1">
        <div class="space-y-3">
          <div class="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-paper-muted">
            <div class="flex items-center gap-3">
              <img :src="`https://www.google.com/s2/favicons?domain=${getDomain(item.link)}&sz=64`" class="w-4 h-4 grayscale group-hover:grayscale-0 transition-all opacity-70 group-hover:opacity-100" alt="" />
              <span :class="{
                'text-blue-700': item.sourceId === 'svt',
                'text-paper-border': item.sourceId === 'dn' || item.sourceId === 'nyt',
                'text-yellow-700': item.sourceId === 'svd',
                'text-orange-600': item.sourceId === 'reddit' || item.sourceId === 'aljazeera',
                'text-paper-accent': item.sourceId === 'bbc' || item.sourceId === 'reuters' || item.sourceId === 'ap',
                'text-emerald-700': item.sourceId === 'sc' || item.sourceId === 'tech'
              }">{{ item.source }}</span>
            </div>
            <span>{{ item.pubDate }}</span>
          </div>
          <h4 class="news-headline text-paper-ink group-hover:text-paper-accent transition-colors leading-[1.1]" 
              :class="idx === 0 && !props.category ? 'text-5xl' : 'text-xl md:text-2xl'">
            {{ item.title }}
          </h4>
          <p v-if="!store.isCompactView" class="text-sm leading-relaxed text-paper-muted italic line-clamp-2 max-w-2xl border-l border-paper-border/10 pl-4">
            {{ item.description?.replace(/<[^>]*>/g, '').slice(0, 150) }}...
          </p>
        </div>
      </a>
    </div>
  </div>
</template>