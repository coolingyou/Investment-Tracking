/**
 * 行情价格缓存 —— 每个用户独立缓存
 */
import { supabase, TABLES, ENV_CHECK } from './config.js';

const PRICE_FALLBACK_KEY = 'trade_tracker_prices';

function loadFallback() {
  try {
    const raw = localStorage.getItem(PRICE_FALLBACK_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveFallback(prices) {
  try { localStorage.setItem(PRICE_FALLBACK_KEY, JSON.stringify(prices)); } catch {}
}

const IS_CLOUD = ENV_CHECK;

/** 读取所有价格缓存 */
export async function fetchPriceCache() {
  if (!IS_CLOUD) return loadFallback();

  var user = await supabase.auth.getUser();
  if (!user?.data?.user) return {};

  const { data, error } = await supabase
    .from(TABLES.PRICE_CACHE)
    .select('*')
    .eq('user_id', user.data.user.id);

  if (error) throw new Error('[Supabase] 查询价格缓存失败: ' + error.message);

  var result = {};
  for (const row of data || []) {
    result[row.ticker] = { price: Number(row.price), ts: new Date(row.updated_at).getTime() };
  }

  // 如果按 user_id 没查到结果，尝试加载旧格式数据（无 user_id 的存量数据）
  if (data && data.length === 0) {
    try {
      const { data: legacy, error: legacyErr } = await supabase
        .from(TABLES.PRICE_CACHE)
        .select('*')
        .is('user_id', null);
      if (!legacyErr && legacy) {
        for (const row of legacy) {
          result[row.ticker] = { price: Number(row.price), ts: new Date(row.updated_at).getTime() };
        }
        // 将旧数据迁移到当前用户
        if (legacy.length > 0) {
          var migrateRows = legacy.map(function (r) {
            return { user_id: user.data.user.id, ticker: r.ticker, price: Number(r.price), updated_at: r.updated_at };
          });
          await supabase.from(TABLES.PRICE