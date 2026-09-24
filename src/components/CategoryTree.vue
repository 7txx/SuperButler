<template>
  <div>
    <template v-for="cat in nodes" :key="cat.id">
      <div
        class="cat-item group flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm text-brand-100/70 hover:text-white"
        :class="modelValue === cat.id ? 'active font-medium' : ''"
        :style="{ paddingLeft: `${12 + depth * 16}px` }"
        @click="$emit('update:modelValue', cat.id)"
      >
        <el-icon v-if="hasChildren(cat.id)" class="mr-1 text-[10px] text-brand-300/60">
          <ArrowRight />
        </el-icon>
        <!-- 无子级时保留与箭头等宽的占位，保证文字对齐 -->
        <span v-else class="mr-1 inline-block w-[10px]"></span>
        <span class="truncate">{{ cat.name }}</span>
      </div>
      <CategoryTree
        v-if="childrenOf(cat.id).length"
        :nodes="childrenOf(cat.id)"
        :all="all"
        :depth="depth + 1"
        :model-value="modelValue"
        @update:model-value="$emit('update:modelValue', $event)"
      />
    </template>
  </div>
</template>

<script setup>
defineOptions({ name: 'CategoryTree' })

const props = defineProps({
  nodes: { type: Array, required: true },
  all: { type: Array, default: () => [] },
  depth: { type: Number, default: 0 },
  modelValue: { type: Number, default: 0 }
})
defineEmits(['update:modelValue'])

function childrenOf(pid) {
  return props.all
    .filter((c) => Number(c.parent_id) === Number(pid))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
}
function hasChildren(pid) {
  return props.all.some((c) => Number(c.parent_id) === Number(pid))
}
</script>
