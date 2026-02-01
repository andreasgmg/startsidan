<script setup lang="ts">
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, getISOWeek } from 'date-fns'
import { sv } from 'date-fns/locale'

const today = new Date()
const monthStart = startOfMonth(today)
const monthEnd = endOfMonth(today)
const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
const days = ['M', 'T', 'O', 'T', 'F', 'L', 'S']
</script>

<template>
  <div class="paper-module transition-colors duration-500">
    <div class="flex justify-between items-center mb-8 border-b border-paper-border pb-2">
      <span class="news-subline italic">Daglig Agenda</span>
      <span class="text-xs font-bold underline">{{ format(today, 'MMMM yyyy', { locale: sv }) }}</span>
    </div>

    <div class="flex justify-between items-end mb-12">
      <div class="flex flex-col">
        <span class="text-sm font-bold uppercase tracking-tighter text-paper-accent italic">{{ format(today, 'EEEE', { locale: sv }) }}</span>
        <span class="news-headline text-9xl leading-none mt-2 tabular-nums">{{ format(today, 'dd') }}</span>
      </div>
      <div class="flex flex-col items-end pb-2">
        <span class="text-[10px] font-black uppercase mb-1 text-paper-muted">Vecka</span>
        <span class="text-5xl font-black italic tabular-nums leading-none text-paper-ink">{{ getISOWeek(today) }}</span>
      </div>
    </div>

    <!-- Månadsöversikt -->
    <div class="grid grid-cols-7 gap-1 mb-8 border-y border-paper-border py-4">
      <div v-for="day in days" :key="day" class="text-[9px] font-black text-center text-paper-muted">{{ day }}</div>
      <div 
        v-for="date in calendarDays" 
        :key="date.toISOString()"
        class="aspect-square flex items-center justify-center text-[10px] font-bold transition-all"
        :class="[
          isToday(date) ? 'bg-paper-ink text-paper-bg scale-110 shadow-lg rotate-3' : 'text-paper-ink',
          date.getDay() === 0 && !isToday(date) ? 'text-paper-accent' : ''
        ]"
      >
        {{ format(date, 'd') }}
      </div>
    </div>

    <div class="space-y-4">
      <div class="flex flex-col">
        <span class="text-[9px] font-black uppercase tracking-widest text-paper-muted mb-1">Namnsdag idag</span>
        <span class="text-xl font-bold italic text-paper-ink">Max & Maximilian</span>
      </div>
      <div class="flex items-center gap-2 text-[10px] font-bold text-paper-muted italic border-t border-paper-border pt-4">
        <span>Uppdaterad för {{ format(today, 'yyyy-MM-dd') }}</span>
      </div>
    </div>
  </div>
</template>