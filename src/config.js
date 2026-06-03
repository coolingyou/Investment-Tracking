import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[TradeTracker] 未配置 Supabase 环境变量。请在项目根目录创建 .env 文件：\n' +
    '  VITE_SUPABASE_URL=https://你的项目.supabase.co\n' +
    '  VITE_SUPABASE_ANON_KEY=你的匿名公钥'
  );
}

/** Supabase 客户端实例 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

/** 数据库表名 */
export const TABLES = {
  PROFILES: 'profiles',
  TRANSACTIONS: 'transactions',
  PRICE_CACHE: 'price_cache',
};

/** 环境变量是否已配置 */
export const ENV_CHECK = !!SUPABASE_URL;
