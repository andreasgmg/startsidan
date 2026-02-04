<script setup lang="ts">
import { ref, computed } from 'vue'
import { useHubStore } from '../stores/useHubStore'
import { Plus, Bookmark, BookmarkCheck, ChevronDown, ChevronRight, BookOpen, X, ExternalLink } from 'lucide-vue-next'

const props = defineProps<{
  category?: string
  topOnly?: boolean
  title?: string
  customItems?: any[]
}>()

const store = useHubStore()
const displayLimit = ref(10)
const isExpanded = ref(true)
const readingItem = ref<NewsItem | null>(null)

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
  sourceCount?: number
  perspectives?: any[]
}

const getDomain = (url: string) => {
  try { return new URL(url).hostname } catch (e) { return '' }
}

const filteredNews = computed(() => {
  if (props.customItems) return props.customItems
  
  const items = (props.topOnly ? store.topNews : store.allNews) as NewsItem[]
  if (!items || items.length === 0) return []
  
  // Top News are pre-calculated/sorted by server
  if (props.topOnly) return items.slice(0, 10)

  // Category filtering for Feed
  if (props.category) {
    return items.filter(item => item.category === props.category)
  }
  
  return items
})

const visibleNews = computed(() => filteredNews.value.slice(0, displayLimit.value))
const showMore = () => displayLimit.value += 10

const handleImageError = (event: any) => {
  event.target.style.display = 'none'
}

const openReader = (item: NewsItem) => {
  readingItem.value = item
  document.body.style.overflow = 'hidden'
}

const closeReader = () => {
  readingItem.value = null
  document.body.style.overflow = ''
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
              <div v-for="(item, idx) in visibleNews" :key="item.link">
                 
                 <!-- BREAKING NEWS LAYOUT (High Impact) -->
                 <div v-if="props.topOnly && (item.sourceCount > 4)" 
                      class="group relative bg-paper-surface border-l-8 border-red-600 pl-8 py-8 pr-4 shadow-sm mb-12 hover:bg-paper-ink/5 transition-colors">
                    
                    <div class="absolute -left-[3px] top-0 bottom-0 w-1 bg-red-600 animate-pulse"></div>
      
                                  <div class="flex items-center justify-between mb-6">
                                    <div class="flex items-center gap-3">
                                      <span class="bg-red-600 text-white text-[10px] font-black uppercase px-2 py-1 tracking-widest animate-pulse">JUST NU</span>
                                      <span class="text-[10px] font-black uppercase tracking-widest text-paper-muted">{{ item.sourceCount }} KÄLLOR RAPPORTERAR</span>
                                    </div>
                                    <!-- Reader Button -->
                                    <button @click.stop="openReader(item)" class="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-paper-ink hover:text-paper-accent transition-colors">
                                      <BookOpen class="h-4 w-4" />
                                      <span class="hidden sm:inline">Läs snabbt</span>
                                    </button>
                                  </div>      
                    <!-- Main Headline -->
                    <a :href="item.link" target="_blank" class="block mb-8">
                      <h4 class="news-headline text-5xl md:text-6xl leading-[0.95] text-paper-ink group-hover:text-red-700 transition-colors">
                        {{ item.title }}
                      </h4>
                      <div class="flex items-center gap-2 mt-3 text-[10px] font-black uppercase tracking-wider text-paper-accent">
                         <span>{{ item.source }}</span>
                         <span class="text-paper-muted"> // {{ item.pubDateFormatted }}</span>
                      </div>
                    </a>
      
                    <!-- Perspectives -->
                    <div v-if="item.perspectives && item.perspectives.length > 0" class="space-y-3 border-t border-paper-border/20 pt-6">
                      <div v-for="p in item.perspectives" :key="p.link" class="flex items-baseline gap-3 text-sm">
                         <span class="font-black uppercase text-[10px] w-20 text-right flex-shrink-0 text-paper-muted">{{ p.source }}</span>
                         <a :href="p.link" target="_blank" class="font-medium italic text-paper-ink hover:underline decoration-paper-accent underline-offset-4">
                           {{ p.title }}
                         </a>
                      </div>
                    </div>
                 </div>
      
                 <!-- STANDARD LAYOUT -->
                 <div v-else
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
                                            
                                            <!-- Reader Button -->
                                            <button @click.prevent="openReader(item)" class="group/btn hover:text-paper-accent transition-colors" title="Läs snabbt">
                                               <BookOpen class="h-4 w-4 opacity-30 group-hover/btn:opacity-100 transition-opacity" />
                                            </button>
                        
                                            <button @click.prevent="store.toggleBookmark(item)" class="hover:text-paper-accent transition-colors">                            <BookmarkCheck v-if="store.isBookmarked(item.link)" class="h-4 w-4 text-paper-accent" />
                            <Bookmark v-else class="h-4 w-4 opacity-30 hover:opacity-100" />
                          </button>
                        </div>
                      </div>
      
                      <a :href="item.link" target="_blank" rel="noopener noreferrer" class="block">
                        <h4 class="news-headline text-paper-ink group-hover:!text-paper-accent transition-all duration-300 leading-[1.1]" 
                            :class="idx === 0 && props.topOnly ? 'text-5xl md:text-7xl' : 'text-xl md:text-2xl'">
                          {{ item.title }}
                        </h4>
                                          <p v-if="!store.isCompactView && item.description" class="mt-4 text-sm leading-relaxed text-paper-muted italic line-clamp-3 max-w-2xl border-l border-paper-border/10 pl-6 group-hover:border-paper-accent/40 transition-colors cursor-pointer" @click.prevent="openReader(item)">
                                            {{ item.description }}
                                          </p>                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <button @click="showMore" class="flex items-center gap-2 mx-auto px-10 py-4 neo-subtle bg-paper-surface font-black text-[10px] uppercase tracking-[0.2em] hover:bg-paper-ink hover:text-paper-bg active:scale-95">
            <Plus class="h-4 w-4" />
            {{ props.title?.startsWith('Senaste') ? props.title.replace('Senaste', 'Visa fler') : 'Visa fler' }}
          </button>
    </div>

    <!-- READER MODE MODAL -->
    <div v-if="readingItem" class="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-paper-bg/95 backdrop-blur-md animate-in fade-in duration-200" @click="closeReader">
      <div class="w-full max-w-3xl bg-paper-bg border-4 border-paper-border shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" @click.stop>
        
        <!-- Header -->
        <div class="flex justify-between items-start p-8 md:p-10 border-b border-paper-border bg-paper-ink/[0.02]">
           <div class="space-y-4 flex-1 pr-8">
              <div class="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-paper-accent">
                <span>{{ readingItem.source }}</span>
                <span class="text-paper-muted">// {{ readingItem.pubDateFormatted }}</span>
              </div>
              <h2 class="news-headline text-3xl md:text-5xl leading-tight text-paper-ink">{{ readingItem.title }}</h2>
           </div>
           <button @click="closeReader" class="p-2 hover:bg-paper-ink hover:text-paper-bg transition-colors rounded-full">
             <X class="h-8 w-8" />
           </button>
        </div>

        <!-- Content -->
        <div class="overflow-y-auto p-10 md:p-12 space-y-8 custom-scrollbar">
           <p class="text-xl md:text-2xl font-serif leading-relaxed text-paper-ink opacity-90 whitespace-pre-line">
             {{ readingItem.description || 'Ingen sammanfattning tillgänglig.' }}
           </p>
           
           <div class="pt-10 mt-10 border-t border-paper-border flex flex-col items-center gap-4">
             <p class="text-xs font-bold uppercase tracking-widest text-paper-muted opacity-60 italic">Du läser en snabbversion</p>
             <a :href="readingItem.link" target="_blank" rel="noopener noreferrer" 
                class="flex items-center gap-3 px-10 py-4 bg-paper-ink text-paper-bg font-black text-xs uppercase tracking-[0.2em] hover:bg-paper-accent transition-all shadow-lg hover:translate-y-[-2px]">
                Läs hela artikeln hos källan
                <ExternalLink class="h-4 w-4" />
             </a>
           </div>
        </div>
      </div>
    </div>
  </div>
</template>