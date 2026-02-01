<script setup lang="ts">
import { ref, computed } from 'vue'
import { X } from 'lucide-vue-next'
import { useHubStore } from '../stores/useHubStore'

const store = useHubStore()
const showAddModal = ref(false)
const newName = ref('')
const newUrl = ref('')

const defaultLinks = [
  { name: 'BankID', url: 'https://www.bankid.com', favicon: 'https://www.google.com/s2/favicons?domain=bankid.com&sz=64' },
  { name: 'Skatteverket', url: 'https://www.skatteverket.se', favicon: 'https://www.google.com/s2/favicons?domain=skatteverket.se&sz=64' },
  { name: '1177', url: 'https://www.1177.se', favicon: 'https://www.google.com/s2/favicons?domain=1177.se&sz=64' },
  { name: 'Postnord', url: 'https://www.postnord.se', favicon: 'https://www.google.com/s2/favicons?domain=postnord.se&sz=64' },
  { name: 'Google Maps', url: 'https://maps.google.com', favicon: 'https://www.google.com/s2/favicons?domain=google.com&sz=64' },
  { name: 'Gmail', url: 'https://mail.google.com', favicon: 'https://www.google.com/s2/favicons?domain=google.com&sz=64' },
]

const allLinks = computed(() => [...defaultLinks, ...store.quickLinks])

const handleAdd = () => {
  if (newName.value && newUrl.value) {
    let url = newUrl.value
    if (!url.startsWith('http')) url = 'https://' + url
    store.addQuickLink(newName.value, url)
    newName.value = ''; newUrl.value = ''; showAddModal.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <div class="flex items-end justify-between border-b-2 border-paper-border pb-2">
      <span class="news-subline italic">Nyttiga resurser & Verktyg</span>
      <button @click="showAddModal = true" class="text-[9px] font-black border border-paper-border px-3 py-1 hover:bg-paper-ink hover:text-paper-bg transition-all uppercase">
        [+ Ny länk]
      </button>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-8">
      <a 
        v-for="link in allLinks" 
        :key="link.url"
        :href="link.url"
        target="_blank"
        rel="noopener noreferrer"
        class="group flex items-center gap-4 py-4 border-b border-paper-border/10 hover:border-paper-ink transition-all"
      >
        <div class="w-8 h-8 flex items-center justify-center grayscale group-hover:grayscale-0 transition-all opacity-40 group-hover:opacity-100">
           <img :src="link.favicon" class="w-full h-full object-contain" alt="" />
        </div>
        <span class="news-subline text-[9px] group-hover:text-paper-ink">{{ link.name }}</span>
      </a>
    </div>

    <!-- Modal Newspaper Style -->
    <div v-if="showAddModal" class="fixed inset-0 bg-paper-bg/95 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div class="paper-module-thick w-full max-w-md p-12 bg-paper-bg">
        <div class="flex justify-between items-center mb-12 border-b-2 border-paper-border pb-4">
          <h4 class="news-headline text-4xl">Ny anslutning</h4>
          <button @click="showAddModal = false" class="hover:text-paper-accent transition-colors"><X class="h-8 w-8" /></button>
        </div>
        <div class="space-y-10">
          <div class="flex flex-col gap-2">
            <label class="news-subline opacity-60">Identifiering</label>
            <input v-model="newName" type="text" placeholder="T.EX. SVT" class="w-full paper-input py-2 text-xl" />
          </div>
          <div class="flex flex-col gap-2">
            <label class="news-subline opacity-60">Webbadress</label>
            <input v-model="newUrl" type="text" placeholder="svt.se" class="w-full paper-input py-2 text-xl" />
          </div>
          <button @click="handleAdd" class="w-full bg-paper-ink text-paper-bg py-5 font-black text-xl hover:bg-paper-accent transition-all italic uppercase tracking-tighter shadow-lg">Initiera länk</button>
        </div>
      </div>
    </div>
  </div>
</template>
