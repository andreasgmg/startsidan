<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import axios from 'axios'
import { useHubStore } from '../stores/useHubStore'
import { Car, AlertTriangle, CheckCircle2 } from 'lucide-vue-next'

const store = useHubStore()
const trafficData = ref({ trafficStatus: 'green', messages: [] as string[] })
const loading = ref(false)

const fetchTraffic = async () => {
  if (!store.selectedCounty) return
  loading.value = true
  try {
    const res = await axios.get(`http://localhost:3001/api/traffic?county=${encodeURIComponent(store.selectedCounty)}`)
    trafficData.value = res.data
  } catch (e) {
    console.error('Failed to fetch traffic', e)
    trafficData.value = { trafficStatus: 'green', messages: ['Kunde inte hämta trafikinfo'] }
  } finally {
    loading.value = false
  }
}

onMounted(fetchTraffic)
watch(() => store.selectedCounty, fetchTraffic)
</script>

<template>
  <div class="p-6 border border-paper-border bg-paper-surface/30 space-y-4">
    <div class="flex items-center justify-between border-b border-paper-border pb-2 opacity-60">
      <div class="flex items-center gap-2">
        <Car class="h-4 w-4" />
        <span class="news-subline !text-[10px]">Trafikläget</span>
      </div>
      <span v-if="store.selectedMunicipality" class="text-[9px] font-black uppercase">{{ store.selectedMunicipality }}</span>
    </div>

    <div v-if="!store.selectedCounty" class="py-4 text-center text-paper-ink">
      <p class="text-[10px] font-bold uppercase opacity-40 leading-relaxed">Välj kommun i inställningar<br/>för trafikinfo</p>
    </div>

    <div v-else class="space-y-4 text-paper-ink">
      <div class="flex items-center gap-4">
        <div 
          class="h-10 w-10 flex items-center justify-center rounded-full border-2 transition-colors duration-500"
          :class="trafficData.trafficStatus === 'red' ? 'bg-paper-accent/10 border-paper-accent text-paper-accent' : 'bg-green-500/10 border-green-500 text-green-500'"
        >
          <AlertTriangle v-if="trafficData.trafficStatus === 'red'" class="h-6 w-6" />
          <CheckCircle2 v-else class="h-6 w-6" />
        </div>
        <div>
          <h4 class="text-lg font-black italic leading-none uppercase tracking-tighter">
            {{ trafficData.trafficStatus === 'red' ? 'Störningar' : 'Flyter på' }}
          </h4>
          <p class="text-[10px] font-bold uppercase opacity-40 mt-1 truncate max-w-[120px]">
            {{ store.selectedCounty }}
          </p>
        </div>
      </div>

      <div v-if="trafficData.messages.length > 0" class="space-y-2 border-t border-paper-border pt-4">
        <div v-for="(msg, i) in trafficData.messages" :key="i" class="flex gap-3 items-start group">
          <div class="mt-1.5 h-1.5 w-1.5 rounded-full bg-paper-accent shrink-0" />
          <p class="text-[11px] font-bold leading-tight opacity-80 italic">{{ msg }}</p>
        </div>
      </div>
      <div v-else-if="trafficData.trafficStatus === 'green'" class="text-[10px] italic opacity-60 font-medium">
        Trafiken flyter på utan större störningar i {{ store.selectedCounty.replace(' län', '') }}.
      </div>
    </div>
  </div>
</template>
