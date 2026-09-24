<template>
  <div class="relative min-h-screen">
    <!-- 星空背景 -->
    <div class="starfield">
      <span
        v-for="s in stars"
        :key="s.id"
        class="star"
        :style="{
          left: s.x + '%',
          top: s.y + '%',
          width: s.r + 'px',
          height: s.r + 'px',
          '--dur': s.dur + 's',
          '--delay': s.delay + 's'
        }"
      />
    </div>

    <!-- 顶栏 -->
    <header class="relative z-20 flex h-16 items-center justify-between gap-3 border-b border-brand-500/15 px-4 glass md:px-6">
      <div class="flex items-center gap-2">
        <button class="text-brand-100/80 hover:text-white md:hidden" @click="catDrawer = true">
          <el-icon :size="20"><Menu /></el-icon>
        </button>
        <router-link to="/" class="flex items-center gap-3">
          <img v-if="logoUrl" :src="logoUrl" alt="logo" class="h-9 w-9 rounded-lg object-cover" />
          <div v-else class="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-800 text-lg shadow-glow">
            <el-icon><Star /></el-icon>
          </div>
          <div class="hidden sm:block">
            <div class="text-base font-semibold text-white">{{ site.title || '超级管家' }}</div>
            <div v-if="site.subtitle" class="text-xs text-brand-200/60">{{ site.subtitle }}</div>
          </div>
        </router-link>
      </div>

      <router-link to="/admin" class="text-sm text-brand-200/70 hover:text-white">管理</router-link>
    </header>

    <!-- 手机端分类抽屉 -->
    <el-drawer v-model="catDrawer" title="分类" direction="ltr" size="260px">
      <CategoryTree :nodes="rootCats" :all="categories" :model-value="activeCategory" @update:model-value="pickCategory" />
    </el-drawer>

    <!-- 主体 -->
    <div class="relative z-10 flex" style="height: calc(100vh - 64px)">
      <!-- 左侧分类（手机端隐藏，用抽屉） -->
      <aside class="hidden w-60 shrink-0 overflow-y-auto border-r border-brand-500/15 p-3 glass md:block">
        <CategoryTree :nodes="rootCats" :all="categories" v-model="activeCategory" />
        <div v-if="!rootCats.length" class="px-3 py-6 text-center text-xs text-brand-200/40">
          暂无分类
        </div>
      </aside>

      <!-- 右侧内容 -->
      <main class="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
        <!-- 搜索栏 -->
        <div class="mx-auto mb-6 w-full max-w-3xl md:mb-8">
          <!-- 引擎切换 -->
          <div class="mb-3 flex flex-wrap justify-center gap-2.5">
            <button
              v-for="e in engines"
              :key="e.id"
              class="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition"
              :class="
                currentEngine.id === e.id
                  ? 'border-brand-400/60 bg-brand-600/20 text-white shadow-glow'
                  : 'border-white/10 bg-white/5 text-brand-100/65 hover:border-brand-400/30 hover:text-white'
              "
              @click="onEngineChange(e)"
            >
              <img v-if="engineIcon(e)" :src="engineIcon(e)" alt="" class="h-4 w-4 object-contain" />
              <span>{{ e.name }}</span>
            </button>
          </div>

          <!-- 搜索框 -->
          <div class="flex items-center overflow-hidden rounded-2xl border border-brand-500/25 bg-ink-800/80 transition focus-within:border-brand-400/70 focus-within:shadow-glow">
            <input
              v-model="keyword"
              type="text"
              class="flex-1 bg-transparent px-5 py-3.5 text-sm text-white placeholder-brand-200/40 outline-none"
              :placeholder="currentEngine.is_internal ? '搜索站内网站…' : `${currentEngine.name}搜索…`"
              @keyup.enter="doSearch"
            />
            <button
              class="mr-1.5 flex h-10 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-500"
              @click="doSearch"
            >
              <el-icon><Search /></el-icon>
            </button>
          </div>
        </div>

        <div class="mb-4 flex items-baseline gap-3 md:mb-6">
          <h2 class="text-xl font-semibold text-white">{{ activeCategoryName }}</h2>
          <span class="text-sm text-brand-200/50">{{ shownBookmarks.length }} 个网站</span>
        </div>

        <div v-if="shownBookmarks.length" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <a
            v-for="b in shownBookmarks"
            :key="b.id"
            :href="b.url"
            target="_blank"
            rel="noopener"
            class="nav-card flex items-start gap-3 rounded-xl border border-brand-500/15 bg-ink-800/60 p-4"
          >
            <div class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink-600">
              <img v-if="b.icon" :src="b.icon" alt="" class="h-8 w-8 object-contain" loading="lazy" />
              <span v-else class="text-base font-semibold text-brand-300">{{ b.name.slice(0, 1) }}</span>
            </div>
            <div class="min-w-0">
              <div class="truncate text-sm font-medium text-white">{{ b.name }}</div>
              <div class="mt-0.5 line-clamp-2 text-xs leading-5 text-brand-200/55">{{ b.description }}</div>
            </div>
          </a>
        </div>

        <el-empty v-else :description="keyword ? '没有匹配的网站' : '该分类下暂无网站'" />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api.js'
import CategoryTree from '../components/CategoryTree.vue'

const site = ref({})
const categories = ref([])
const allBookmarks = ref([])
const engines = ref([])
const activeCategory = ref(0)
const keyword = ref('')
const catDrawer = ref(false)
const currentEngine = ref({ id: 0, name: '站内', is_internal: true })
const logoVersion = ref('0')

// 星空
const stars = Array.from({ length: 130 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  r: Math.random() * 2 + 0.6,
  dur: Math.random() * 3 + 2,
  delay: Math.random() * 4
}))

const rootCats = computed(() =>
  categories.value
    .filter((c) => Number(c.parent_id) === 0)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
)

const activeCategoryName = computed(() => {
  if (keyword.value && currentEngine.value.is_internal) return '搜索结果'
  const c = categories.value.find((x) => x.id === activeCategory.value)
  return c ? c.name : ''
})

const logoUrl = computed(() =>
  logoVersion.value !== '0' ? `/api/public/logo?v=${logoVersion.value}` : ''
)

// 当前分类（含子孙分类）下的书签
const shownBookmarks = computed(() => {
  let list = allBookmarks.value
  if (keyword.value && currentEngine.value.is_internal) {
    const kw = keyword.value.toLowerCase()
    return list.filter(
      (b) =>
        b.name.toLowerCase().includes(kw) ||
        (b.description || '').toLowerCase().includes(kw) ||
        b.url.toLowerCase().includes(kw)
    )
  }
  const ids = new Set([activeCategory.value])
  let changed = true
  while (changed) {
    changed = false
    for (const cat of categories.value) {
      if (ids.has(cat.parent_id) && !ids.has(cat.id)) {
        ids.add(cat.id)
        changed = true
      }
    }
  }
  return list.filter((b) => ids.has(b.category_id))
})

function pickCategory(id) {
  activeCategory.value = id
  catDrawer.value = false
}

function onEngineChange(engine) {
  currentEngine.value = engine
  keyword.value = ''
}

// 引擎图标仅支持图片地址
function engineIcon(e) {
  return e.icon && /^(https?:\/\/|\/)/.test(e.icon) ? e.icon : ''
}

function doSearch() {
  const kw = keyword.value.trim()
  if (!kw) return
  const engine = currentEngine.value
  if (engine.is_internal) return // 站内为实时过滤
  window.open(engine.url_template.replace('{q}', encodeURIComponent(kw)), '_blank')
}

onMounted(async () => {
  const [s, nav] = await Promise.all([
    api.get('/api/public/site'),
    api.get('/api/public/nav')
  ])
  site.value = s
  logoVersion.value = s.logo_version
  document.title = s.title || '超级管家'
  categories.value = nav.categories
  allBookmarks.value = nav.bookmarks
  engines.value = nav.engines
  if (nav.engines.length) currentEngine.value = nav.engines[0]
  const def = nav.categories.find((c) => c.is_default) || rootCats.value[0]
  if (def) activeCategory.value = def.id
})
</script>
