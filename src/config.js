import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[TradeTracker] 未配置 Supabase 环境变量。请在项目根目录创建 .env 文件'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export const TABLES = {
  PROFILES: 'profiles',
  TRANSACTIONS: 'transactions',
  PRICE_CACHE: 'price_cache',
};

export const ENV_CHECK = !!SUPABASE_URL;
