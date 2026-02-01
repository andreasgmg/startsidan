<script setup lang="ts">
import { computed } from 'vue'
import { useHubStore } from '../stores/useHubStore'

const props = defineProps<{
  category?: string
  topOnly?: boolean
}>()

const store = useHubStore()

interface NewsItem {
  title: string
  link: string
  source: string
  pubDateFormatted: string
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

const filteredNews = computed(() => {
  const items = (props.topOnly ? store.topNews : store.allNews) as NewsItem[]
  if (!items || items.length === 0) return []
  
  if (props.topOnly) return items.slice(0, 10)

  const categoryItems = props.category 
    ? items.filter(item => item.category === props.category)
    : items

  const seenTitles = new Set<string>()
  return categoryItems.filter(item => {
    const normalized = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40)
    if (seenTitles.has(normalized)) return false
    seenTitles.add(normalized)
    return true
  })
})
</script>

<template>
  <div class="space-y-8">
    <div class="flex items-center gap-4 border-b-2 border-paper-border pb-2 opacity-80">
      <span class="news-subline italic text-paper-accent !text-sm">
        {{ props.topOnly ? 'Analyserade Toppnyheter' : (props.category || 'Flöde') }}
      </span>
      <div class="h-[1px] flex-1 bg-paper-border opacity-20"></div>
    </div>
    
    <div v-if="store.newsLoading" class="space-y-8 animate-pulse">
      <div class="h-40 bg-paper-ink/5 rounded-xl"></div>
      <div class="h-20 bg-paper-ink/5 rounded-xl"></div>
    </div>

    <div v-else-if="filteredNews.length === 0" class="py-12 text-center border-2 border-dotted border-paper-border opacity-20">
      <p class="text-sm italic">Synkroniserar arkivet...</p>
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
                'text-paper-accent': item.sourceId === 'bbc' || item.sourceId === 'reuters',
                'text-orange-600': item.sourceId === 'reddit' || item.sourceId === 'aljazeera',
                'text-emerald-700': item.sourceId === 'sc' || item.sourceId === 'tech'
              }">{{ item.source }}</span>
            </div>
            <span>{{ item.pubDateFormatted }}</span>
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