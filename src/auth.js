/**
 * 用户认证与资料管理
 */
import { supabase, TABLES, ENV_CHECK } from './config.js';

/* ---------- 认证 ---------- */

/** 邮箱 + 密码注册 */
export async function signUp(email, password, nickname) {
  var { data, error } = await supabase.auth.signUp({
    email: email,
    password: password,
    options: {
      data: { full_name: nickname || email.split('@')[0] },
    },
  });
  if (error) throw new Error(error.message);
  return data;
}

/** 邮箱 + 密码登录 */
export async function signIn(email, password) {
  var { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  });
  if (error) throw new Error(error.message);
  return data;
}

/** OAuth 登录（Google / Microsoft / Facebook） */
export async function signInWithOAuth(provider) {
  // 用当前页面的确切 URL 作为重定向地址
  var redirectUrl = window.location.origin;
  // 确保去掉末尾的 index.html
  if (redirectUrl.endsWith('/index.html')) {
    redirectUrl = redirectUrl.replace('/index.html', '');
  }

  var { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider,
    options: { redirectTo: redirectUrl },
  });
  if (error) throw new Error(error.message);
  return data;
}

/** 登出 */
export async function signOut() {
  var { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

/** 发送重置密码邮件 */
export async function sendPasswordReset(email) {
  var { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw new Error(error.message);
}

/** 获取当前登录用户 */
export function getCurrentUser() {
  return supabase.auth.getUser();
}

/** 监听认证状态变化 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

/* ---------- 资料 ---------- */

/** 获取用户资料 */
export async function fetchProfile(userId) {
  var { data, error } = await supabase
    .from(TABLES.PROFILES)
    .select('*')
    .eq('id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  return data;
}

/** 更新用户资料（昵称 / 头像） */
export async function updateProfile(userId, updates) {
  var { data, error } = await supabase
    .from(TABLES.PROFILES)
    .upsert({ id: userId, ...updates, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** 检查当前是否已登录（仅限 Su
/** 检查当前是否已登录（仅限 Supabase 在线模式） */
export async function requireAuth() {
  if (!ENV_CHECK) return null;
  var { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}
