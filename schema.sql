-- ============================================================
-- Lover 项目数据库结构（Cloudflare D1 / SQLite）
-- 可重复执行（IF NOT EXISTS）
-- ============================================================

-- 管理员（固定单行 id=1）
CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  username      TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

-- 站点设置（键值对）
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- 导航分类（支持多级，parent_id=0 为顶级）
CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  parent_id  INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- 导航书签
CREATE TABLE IF NOT EXISTS bookmarks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon        TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

-- 搜索引擎（is_internal=1 为站内搜索，url_template 中用 {q} 占位关键词）
CREATE TABLE IF NOT EXISTS search_engines (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  url_template TEXT NOT NULL,
  icon         TEXT NOT NULL DEFAULT '',
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_active    INTEGER NOT NULL DEFAULT 1,
  is_internal  INTEGER NOT NULL DEFAULT 0
);

-- 通知渠道（type: pushplus | smtp，config 为 JSON）
CREATE TABLE IF NOT EXISTS channels (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL,
  config     TEXT NOT NULL DEFAULT '{}',
  enabled    INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

-- 订阅项目
CREATE TABLE IF NOT EXISTS subscriptions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  remark         TEXT NOT NULL DEFAULT '',
  tags           TEXT NOT NULL DEFAULT '',
  amount         REAL NOT NULL DEFAULT 0,
  currency       TEXT NOT NULL DEFAULT 'CNY',
  type           TEXT NOT NULL,                  -- 历史遗留列，新数据统一写 cycle
  is_lunar       INTEGER NOT NULL DEFAULT 0,
  target_date    TEXT NOT NULL,                  -- 下次到期 YYYY-MM-DD（公历）
  period_value   INTEGER NOT NULL DEFAULT 1,
  period_unit    TEXT NOT NULL DEFAULT 'year',   -- day | month | year
  lunar_month    INTEGER,
  lunar_day      INTEGER,
  remind_days    TEXT NOT NULL DEFAULT '7',      -- 提前提醒天数（单值）
  remind_time    TEXT NOT NULL DEFAULT '08:00',  -- 每天提醒发送时间（北京时间 HH:MM）
  renew_offset_days INTEGER NOT NULL DEFAULT 0,  -- 到期后第 N 天自动续期（0=到期当天）
  enabled        INTEGER NOT NULL DEFAULT 1,
  auto_renew     INTEGER NOT NULL DEFAULT 1,
  pending_renew  INTEGER NOT NULL DEFAULT 0,
  last_renew_at  TEXT,
  notified_keys  TEXT NOT NULL DEFAULT '',       -- 当前到期周期内已推送过的提前天数，避免重复
  channel_ids    TEXT NOT NULL DEFAULT '',       -- 绑定渠道，空串=所有已启用渠道
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL
);

-- 通知发送记录
CREATE TABLE IF NOT EXISTS notify_logs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER,
  channel_id      INTEGER,
  success         INTEGER NOT NULL,
  content         TEXT NOT NULL DEFAULT '',
  created_at      INTEGER NOT NULL
);

-- 网站监控
CREATE TABLE IF NOT EXISTS monitors (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT NOT NULL,
  url              TEXT NOT NULL,
  interval_seconds INTEGER NOT NULL DEFAULT 3600,
  enabled          INTEGER NOT NULL DEFAULT 1,
  hidden           INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'unknown', -- up | down | unknown
  status_code      INTEGER,
  last_checked_at  TEXT,
  last_error       TEXT NOT NULL DEFAULT '',
  response_ms      INTEGER,
  check_count      INTEGER NOT NULL DEFAULT 0,
  up_count         INTEGER NOT NULL DEFAULT 0,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL
);

-- ============================================================
-- 默认数据（仅首次初始化时写入）
-- ============================================================
INSERT INTO categories (name, parent_id, sort_order, is_default, created_at)
SELECT '常用推荐', 0, 0, 1, strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE is_default = 1);

INSERT INTO search_engines (name, url_template, icon, sort_order, is_active, is_internal)
SELECT '站内', '', '', 0, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM search_engines WHERE is_internal = 1);

INSERT INTO search_engines (name, url_template, icon, sort_order, is_active, is_internal)
SELECT '必应', 'https://www.bing.com/search?q={q}', '', 1, 1, 0
WHERE NOT EXISTS (SELECT 1 FROM search_engines WHERE name = '必应');

INSERT INTO search_engines (name, url_template, icon, sort_order, is_active, is_internal)
SELECT 'Yandex', 'https://yandex.com/search/?text={q}', '', 2, 1, 0
WHERE NOT EXISTS (SELECT 1 FROM search_engines WHERE name = 'Yandex');

INSERT INTO search_engines (name, url_template, icon, sort_order, is_active, is_internal)
SELECT 'Github', 'https://github.com/search?q={q}', '', 3, 1, 0
WHERE NOT EXISTS (SELECT 1 FROM search_engines WHERE name = 'Github');
