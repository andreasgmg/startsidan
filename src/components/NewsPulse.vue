<script setup lang="ts">
import { ref, computed } from 'vue'
import { useHubStore } from '../stores/useHubStore'
import { Plus, Bookmark, BookmarkCheck, ChevronDown, ChevronRight } from 'lucide-vue-next'

const props = defineProps<{
  category?: string
  topOnly?: boolean
  title?: string
  customItems?: any[]
}>()

const store = useHubStore()
const displayLimit = ref(10)
const isExpanded = ref(true)

interface NewsItem {
  title: string
  link: string
  source: string
  pubDateFormatted: string
  rawDate: Date
  description?: string
  sourceId: string
  category: string
  image?: string
  sentiment?: number
}

const getDomain = (url: string) => {
  try { return new URL(url).hostname } catch (e) { return '' }
}

const filteredNews = computed(() => {
  if (props.customItems) return props.customItems
  
  const items = (props.topOnly ? store.topNews : store.allNews) as NewsItem[]
  if (!items || items.length === 0) return []
  
  if (props.topOnly) return items.slice(0, 10)

  const categoryItems = props.category 
    ? items.filter(item => item.category === props.category)
    : items

  const sorted = [...categoryItems].sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime())
  const seenTitles = new Set<string>()
  return sorted.filter(item => {
    const normalized = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40)
    if (seenTitles.has(normalized)) return false
    seenTitles.add(normalized)
    return true
  })
})

const visibleNews = computed(() => filteredNews.value.slice(0, displayLimit.value))
const showMore = () => displayLimit.value += 10

const handleImageError = (event: any) => {
  event.target.style.display = 'none'
}
</script>

<template>
  <div class="space-y-8">
    <!-- Accordion Header -->
    <div 
      @click="isExpanded = !isExpanded"
      class="flex items-center gap-4 border-b-2 border-paper-border pb-2 opacity-80 hover:opacity-100 transition-all cursor-pointer group/header"
    >
      <div class="w-2 h-8" :class="{
        'bg-paper-accent': props.topOnly,
        'bg-blue-600/40': props.category === 'Världen',
        'bg-emerald-600/40': props.category === 'Sverige',
        'bg-amber-600/40': ['Teknik', 'Vetenskap', 'Spel'].includes(props.category || ''),
        'bg-orange-600/40': props.category === 'Reddit',
        'bg-paper-muted': !props.category && !props.topOnly
      }"></div>
      
      <div class="flex items-center gap-3">
        <component :is="isExpanded ? ChevronDown : ChevronRight" class="h-4 w-4 text-paper-muted group-hover/header:text-paper-accent transition-colors" />
        <span class="news-subline italic text-paper-accent !text-sm uppercase tracking-widest">
          {{ props.title || (props.topOnly ? 'Toppnyheter (24h)' : (props.category || 'Flöde')) }}
        </span>
      </div>

      <div class="h-[1px] flex-1 bg-paper-border opacity-20"></div>
      
      <span v-if="!isExpanded && filteredNews.length > 0" class="text-[10px] font-black uppercase opacity-40 px-2 py-1 border border-paper-border/20">
        {{ filteredNews.length }} artiklar
      </span>
    </div>
    
    <!-- Accordion Content -->
    <div v-if="isExpanded" class="space-y-12">
      <div v-if="store.newsLoading && !props.customItems" class="space-y-8 animate-pulse">
        <div class="h-48 bg-paper-ink/5"></div>
        <div class="h-24 bg-paper-ink/5"></div>
      </div>

      <div v-else-if="visibleNews.length === 0" class="py-12 text-center border-2 border-dotted border-paper-border opacity-20">
        <p class="text-sm italic">Inga nyheter att visa just nu.</p>
      </div>

      <div v-else class="space-y-12">
        <div v-for="(item, idx) in visibleNews" :key="item.link" 
           class="group block border-b border-paper-border pb-10 last:border-0 transition-all border-l-2 pl-6 -ml-6"
           :class="{
             'border-transparent': !item.sentiment || item.sentiment === 0,
             'border-red-600/30': item.sentiment === -1,
             'border-emerald-600/30': item.sentiment === 1
           }">
          
          <div class="space-y-6">
            <!-- Top Feature Image -->
            <div v-if="props.topOnly && idx === 0 && item.image" class="w-full h-80 overflow-hidden border-2 border-paper-border mb-8 bg-paper-ink/5 shadow-sm">
              <img :src="item.image" @error="handleImageError" class="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000 scale-105 group-hover:scale-100" alt="" />
            </div>

            <div class="flex items-start gap-8">
              <div v-if="props.topOnly && idx > 0 && item.image" class="hidden md:block w-32 h-32 flex-shrink-0 overflow-hidden border-2 border-paper-border bg-paper-ink/5 shadow-sm">
                <img :src="item.image" @error="handleImageError" class="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" alt="" />
              </div>

              <div class="flex-1 space-y-4">
                <div class="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-paper-ink">
                  <div class="flex items-center gap-3">
                    <img :src="`https://www.google.com/s2/favicons?domain=${getDomain(item.link)}&sz=64`" class="w-4 h-4 grayscale group-hover:grayscale-0 opacity-70 group-hover:opacity-100 transition-all" alt="" />
                    <span :class="{
                      'text-blue-700': item.sourceId === 'svt',
                      'text-paper-accent': ['bbc', 'npr', 'ap', 'reuters', 'newsapi', 'kris'].includes(item.sourceId),
                      'text-orange-600': item.sourceId === 'reddit',
                      'text-emerald-700': ['sc', 'tech', 'hn'].includes(item.sourceId)
                    }">{{ item.source }}</span>
                  </div>
                  <div class="flex items-center gap-4">
                    <span class="text-paper-muted">{{ item.pubDateFormatted }}</span>
                    <button @click.prevent="store.toggleBookmark(item)" class="hover:text-paper-accent transition-colors">
                      <BookmarkCheck v-if="store.isBookmarked(item.link)" class="h-4 w-4 text-paper-accent" />
                      <Bookmark v-else class="h-4 w-4 opacity-30 hover:opacity-100" />
                    </button>
                  </div>
                </div>

                <a :href="item.link" target="_blank" rel="noopener noreferrer" class="block">
                  <h4 class="news-headline text-paper-ink group-hover:!text-paper-accent transition-all duration-300 leading-[1.1]" 
                      :class="idx === 0 && props.topOnly ? 'text-5xl md:text-7xl' : 'text-xl md:text-2xl'">
                    {{ item.title }}
                  </h4>
                  <p v-if="!store.isCompactView && item.description" class="mt-4 text-sm leading-relaxed text-paper-muted italic line-clamp-3 max-w-2xl border-l border-paper-border/10 pl-6 group-hover:border-paper-accent/40 transition-colors">
                    {{ item.description }}
                  </p>
                </a>
              </div>
            </div>
          </div>
        </div>

        <div v-if="filteredNews.length > displayLimit" class="pt-4 text-center">
          <button @click="showMore" class="flex items-center gap-2 mx-auto px-10 py-4 neo-subtle bg-paper-surface font-black text-[10px] uppercase tracking-[0.2em] hover:bg-paper-ink hover:text-paper-bg active:scale-95">
            <Plus class="h-4 w-4" />
            {{ props.title?.startsWith('Senaste') ? props.title.replace('Senaste', 'Visa fler') : 'Visa fler' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>