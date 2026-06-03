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
var supabaseUrl = SUPABASE_URL;
var supabaseKey = SUPABASE_ANON_KEY;

// 如果在 Vercel 环境而且没有配置环境变量，就用 Vercel 环境变量
// (import.meta.env 在 Vite 构建后不可用，需要运行时判断)
try {
  if (!supabaseUrl && typeof process !== 'undefined' && process.env && process.env.VITE_SUPABASE_URL) {
    supabaseUrl = process.env.VITE_SUPABASE_URL;
 