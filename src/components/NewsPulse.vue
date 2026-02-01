<script setup lang="ts">
import { computed } from 'vue'
import { useHubStore } from '../stores/useHubStore'
import { formatDistanceToNow } from 'date-fns'
import { sv } from 'date-fns/locale'

const props = defineProps<{
  category?: string
  topOnly?: boolean
}>()

const store = useHubStore()

interface NewsItem {
  title: string
  link: string
  source: string
  pubDate: string
  rawDate: Date
  description?: string
  sourceId: string
  category: string
  image?: string
}

const getDomain = (url: string) => {
  try {
    return new URL(url).hostname
  } catch (e) {
    return ''
  }
}

const parseDate = (date: Date) => {
  return formatDistanceToNow(date, { addSuffix: true, locale: sv })
    .replace('tio', '10').replace('elva', '11').replace('tolv', '12')
}

const filteredNews = computed(() => {
  const items = (props.topOnly ? store.topNews : store.allNews) as NewsItem[]
  if (!items || items.length === 0) return []
  
  const categoryItems = props.category 
    ? items.filter(item => item.category === props.category)
    : items

  // Visa nyaste först för kategorier, men Top 5 är redan sorterad efter vikt
  const sorted = props.topOnly 
    ? categoryItems 
    : [...categoryItems].sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime())

  const seenTitles = new Set<string>()
  return sorted.filter(item => {
    const normalized = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40)
    if (seenTitles.has(normalized)) return false
    seenTitles.add(normalized)
    return true
  })
})
</script>

<template>
  <div class="space-y-8">
    <div class="flex items-center gap-4 border-b-2 border-paper-border pb-2 opacity-80 transition-colors duration-500">
      <span class="news-subline italic text-paper-accent !text-sm uppercase tracking-widest">
        {{ props.topOnly ? 'Toppnyheter (24h)' : (props.category || 'Nyhetsflöde') }}
      </span>
      <div class="h-[1px] flex-1 bg-paper-border opacity-20"></div>
    </div>
    
    <div v-if="store.newsLoading" class="space-y-8 animate-pulse">
      <div class="h-40 bg-paper-ink/5 rounded-xl"></div>
      <div class="h-20 bg-paper-ink/5 rounded-xl"></div>
    </div>

    <div v-else-if="filteredNews.length === 0" class="py-12 text-center border-2 border-dotted border-paper-border opacity-20">
      <p class="text-sm italic">Inga nyheter hittades för denna sektion.</p>
    </div>

    <div v-else class="space-y-12">
      <a v-for="(item, idx) in filteredNews" :key="item.link" :href="item.link" target="_blank" rel="noopener noreferrer" 
         class="group block border-b border-paper-border pb-10 last:border-0 transition-all hover:translate-x-1">
        
        <div class="space-y-6">
          <div v-if="props.topOnly && idx === 0 && item.image" class="w-full h-64 overflow-hidden rounded-xl border-2 border-paper-border mb-6">
            <img :src="item.image" class="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000 scale-105 group-hover:scale-100" alt="" />
          </div>

          <div class="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-paper-ink">
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
            <span class="text-paper-muted">{{ parseDate(item.rawDate) }}</span>
          </div>

          <h4 class="news-headline text-paper-ink group-hover:text-paper-accent transition-colors leading-[1.1]" 
              :class="idx === 0 && props.topOnly ? 'text-5xl md:text-6xl' : 'text-xl md:text-3xl'">
            {{ item.title }}
          </h4>
          
          <p v-if="!store.isCompactView" class="text-sm leading-relaxed text-paper-muted italic line-clamp-3 max-w-2xl border-l border-paper-border/10 pl-6">
            {{ item.description }}
          </p>
        </div>
      </a>
    </div>
  </div>
</template>
