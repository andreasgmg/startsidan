<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { Plus, Check, Trash2, GripVertical } from 'lucide-vue-next'
import draggable from 'vuedraggable'

const todos = ref<{ id: number, text: string, done: boolean }[]>([])
const newTodo = ref('')

onMounted(() => {
  const saved = localStorage.getItem('hub_todos')
  if (saved) todos.value = JSON.parse(saved)
})

watch(todos, (val) => {
  localStorage.setItem('hub_todos', JSON.stringify(val))
}, { deep: true })

const progress = computed(() => {
  if (todos.value.length === 0) return 0
  const done = todos.value.filter(t => t.done).length
  return Math.round((done / todos.value.length) * 100)
})

const addTodo = () => {
  if (newTodo.value.trim()) {
    todos.value.push({ id: Date.now(), text: newTodo.value.trim().toUpperCase(), done: false })
    newTodo.value = ''
  }
}

const removeTodo = (id: number) => {
  todos.value = todos.value.filter(t => t.id !== id)
}
</script>

<template>
  <div class="paper-module transition-colors duration-500">
    <div class="flex justify-between items-center mb-10 border-b border-paper-border pb-2 opacity-80">
      <span class="news-subline italic">Dagens Uppdrag</span>
      <span class="text-xs font-black italic underline text-paper-accent">{{ progress }}% avklarat</span>
    </div>

    <div class="flex gap-2 mb-10">
      <input 
        v-model="newTodo" 
        @keydown.enter="addTodo"
        type="text" 
        placeholder="NOTERA NY UPPGIFT..."
        class="flex-1 paper-input py-2 px-2 text-sm italic placeholder:text-paper-muted placeholder:opacity-30"
      />
      <button @click="addTodo" class="p-2 border border-paper-border hover:bg-paper-ink hover:text-paper-bg transition-all bg-paper-bg">
        <Plus class="h-5 w-5" />
      </button>
    </div>

    <!-- Draggable List -->
    <draggable 
      v-model="todos" 
      item-key="id" 
      handle=".drag-handle"
      class="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar"
    >
      <template #item="{ element: todo }">
        <li class="flex items-center justify-between group py-3 border-b border-paper-border/10 bg-paper-surface/20 px-3 transition-all hover:bg-paper-surface/40">
          <div class="flex items-center gap-4 cursor-pointer flex-1" @click="todo.done = !todo.done">
            <div class="drag-handle cursor-grab active:cursor-grabbing text-paper-muted opacity-0 group-hover:opacity-40 transition-opacity">
              <GripVertical class="h-4 w-4" />
            </div>
            <div class="w-5 h-5 border border-paper-border flex items-center justify-center transition-all" 
                 :class="todo.done ? 'bg-paper-ink' : ''">
              <Check v-if="todo.done" class="h-3 w-3 text-paper-bg" />
            </div>
            <span class="text-[13px] font-bold italic transition-all text-paper-ink" 
                  :class="todo.done ? 'opacity-20 line-through' : ''">
              {{ todo.text }}
            </span>
          </div>
          <button @click="removeTodo(todo.id)" class="opacity-0 group-hover:opacity-100 text-paper-accent transition-all p-1">
            <Trash2 class="h-4 w-4" />
          </button>
        </li>
      </template>
    </draggable>
  </div>
</template>