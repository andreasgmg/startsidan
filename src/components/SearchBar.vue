<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Search } from 'lucide-vue-next'

const query = ref('')
const searchInput = ref<HTMLInputElement | null>(null)

const engines: Record<string, string> = {
  '/g': 'https://www.google.com/search?q=',
  '/gpt': 'https://chat.openai.com/?q=',
  '/p': 'https://www.prisjakt.nu/search?search=',
  '/yt': 'https://www.youtube.com/results?search_query='
}

const handleSearch = () => {
  const trimmed = query.value.trim()
  if (!trimmed) return
  const parts = trimmed.split(' ')
  const prefix = parts[0] || ''
  const searchTerm = parts.slice(1).join(' ')
  if (prefix && engines[prefix] && searchTerm) {
    window.location.href = engines[prefix] + encodeURIComponent(searchTerm)
  } else {
    window.location.href = engines['/g'] + encodeURIComponent(trimmed)
  }
}

onMounted(() => {
  searchInput.value?.focus()
})
</script>

<template>
  <div class="relative group">
    <div class="absolute -top-4 -left-4 px-3 py-1 bg-neo-border text-neo-surface text-[10px] font-black uppercase tracking-[0.2em] z-10">
      Sök
    </div>
    <div class="neo-card !p-0 flex items-center bg-white group-focus-within:border-neo-accent transition-colors">
      <div class="pl-8 text-neo-border">
        <Search class="h-8 w-8" />
      </div>
      <input
        ref="searchInput"
        v-model="query"
        type="text"
        class="w-full bg-transparent p-10 text-4xl md:text-6xl font-black italic tracking-tighter uppercase focus:outline-none placeholder-slate-200"
        placeholder="Vad letar du efter?"
        @keydown.enter="handleSearch"
      />
    </div>
    <div class="mt-4 flex justify-between text-[10px] font-black uppercase tracking-widest text-neo-muted px-4">
      <div class="flex gap-6">
        <span class="hover:text-neo-accent cursor-help">/G Google</span>
        <span class="hover:text-neo-accent cursor-help">/GPT AI</span>
        <span class="hover:text-neo-accent cursor-help">/P Prisjakt</span>
      </div>
      <span class="animate-pulse">Systemet är redo</span>
    </div>
  </div>
</template>
