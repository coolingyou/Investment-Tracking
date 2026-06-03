/**
 * 交易记录 CRUD —— 通过 Supabase 操作云端数据库
 * 所有操作均绑定当前登录用户的 user_id
 */
import { supabase, TABLES, ENV_CHECK } from './config.js';

const TX_FALLBACK_KEY = 'trade_tracker_transactions';

function loadFallback() {
  try {
    const raw = localStorage.getItem(TX_FALLBACK_KEY);
    if (raw) return JSON.parse(raw).map(t => ({ ...t, id: t.id || crypto.randomUUID() }));
  } catch (e) {}
  return [];
}
function saveFallback(data) {
  try { localStorage.setItem(TX_FALLBACK_KEY, JSON.stringify(data)); } catch (e) {}
}

const IS_CLOUD = ENV_CHECK;

/* 查询所有交易记录 */
export async function fetchTransactions() {
  if (!IS_CLOUD) { return loadFallback(); }

  var user = await supabase.auth.getUser();
  if (!user?.data?.user) throw new Error('请先登录');

  const { data, error } = await supabase
    .from(TABLES.TRANSACTIONS)
    .select('*')
    .eq('user_id', user.data.user.id)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error('[Supabase] 查询交易记录失败: ' + error.message);

  return (data || []).map(t => ({
    id: t.id, type: t.type, ticker: t.ticker, name: t.name,
    exchange: t.exchange, shares: Number(t.shares), price: Number(t.price),
    fee: Number(t.fee) || 0,
    totalAmount: Number(t.total_amount) || (t.type === 'buy'
      ? Number(t.shares) * Number(t.price) + (Number(t.fee) || 0)
      : Number(t.shares) * Number(t.price) - (Number(t.fee) || 0)),
    date: t.date || '', note: t.note || '', createdAt: t.created_at,
  }));
}

/* 新增一条交易记录 */
export async function createTransaction(args) {
  var type = args.type, ticker = args.ticker, name = args.name, exchange = args.exchange;
  var shares = args.shares, price = args.price, fee = args.fee || 0;
  var date = args.date || '', note = args.note || '';

  var numShares = Number(shares), numPrice = Number(price), numFee = Number(fee);
  var totalAmount = type === 'buy'
    ? numShares * numPrice + numFee
    : numShares * numPrice - numFee;

  if (!IS_CLOUD) {
    const record = {
      id: crypto.randomUUID(),
      type: type, ticker: ticker, name: name, exchange: exchange,
      shares: numShares, price: numPrice, fee: numFee, totalAmount: totalAmount,
      date: date, note: note, createdAt: new Date().toISOString(),
    };
    const fb = loadFallback(); fb.push(record); saveFallback(fb);
    return record;
  }

  var user = await supabase.auth.getUser();
  if (!user?.data?.user) throw new Error('请先登录');

  const { data, error } = await supabase
    .from(TABLES.TRANSACTIONS)
    .insert({
      user_id: user.data.user.id,
      type: type, ticker: ticker.toUpperCase(), name: name, exchange: exchange,
      shares: numShares, price: numPrice, fee: numFee, total_amount: totalAmount,
      date: date, note: note,
    })
    .select()
    .single();

  if (error) throw new Error('[Supabase] 创建交易记录失败: ' + error.message);

  return {
    id: data.id, type: data.type, ticker: data.ticker, name: data.name,
    exchange: data.exchange, shares: Number(data.shares), price: Number(data.price),
    fee: Number(data.fee) || 0, totalAmount: Number(data.total_amount),
    date: data.date || '', note: data.note || '', createdAt: data.created_at,
  };
}

/* 更新交易记录 */
export async function updateTransaction(id, args) {
  var type = args.type, ticker = args.ticker, name = args.name, exchange = args.exchange;
  var shares = args.shares, price = args.price, fee = args.fee || 0;
  var date = args.date || '', note = args.note || '';

  var numShares = Number(shares), numPrice = Number(price), numFee = Number(fee);
  var totalAmount = type === 'buy'
    ? numShares * numPrice + numFee
    : numShares * numPrice - numFee;

  if (!IS_CLOUD) {
    const fb = loadFallback();
    const idx = fb.findIndex(t => t.id === id);
    if (idx === -1) throw new Error('[Fallback] 未找到记录: ' + id);
    fb[idx] = { ...fb[idx], type: type, ticker: ticker, name: name, exchange: exchange, shares: numShares, price: numPrice, fee: numFee, totalAmount: totalAmount, date: date, note: note };
    saveFallback(fb);
    return fb[idx];
  }

  const { data, error } = await supabase
    .from(TABLES.TRANSACTIONS)
    .update({
      type: type, ticker: ticker.toUpperCase(), name: name, exchange: exchange,
      shares: numShares, price: numPrice, fee: numFee, total_amount: totalAmount,
      date: date, note: note,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error('[Supabase] 更新交易记录失败: ' + error.message);
  return data;
}

/* 删除交易记录 */
export async function deleteTransaction(id) {
  if (!IS_CLOUD) {
    const fb = loadFallback();
    saveFallback(fb.filter(t => t.id !== id));
    return;
  }
  const { error } = await supabase.from(TABLES.TRANSACTIONS).delete().eq('id', id);
  if (error) throw new Error('[Supabase] 删除交易记录失败: ' + error.message);
}

/* 查询所有交易记录（原始格式，用于 FIFO 计算） */
export async function fetchAllTransactionsRaw() {
  if (!IS_CLOUD) { return loadFallback(); }
  var user = await supabase.auth.getUser();
  if (!user?.data?.user) throw new Error('请先登录');

  const { data, error } = await supabase
    .from(TABLES.TRANSACTIONS)
    .select('*')
    .eq('user_id', user.data.user.id)
    .order('date', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw new Error('[Supabase] 查询全部交易失败: ' + error.message);

  return (data || []).map(t => ({
    id: t.id, type: t.type, ticker: t.ticker, name: t.name,
    exchange: t.exchange, shares: Number(t.shares), price: Number(t.price),
    fee: Number(t.fee) || 0,
    totalAmount: Number(t.total_amount) || (t.type === 'buy'
      ? Number(t.shares) * Number(t.price) + (Number(t.fee) || 0)
      : Number(t.shares) * Number(t.price) - (Number(t.fee) || 0)),
    date: t.date || '', note: t.note || '',
  }));
}
