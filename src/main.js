/**
 * TradeTracker — 主入口模块
 * 集成用户认证、数据隔离
 */
import {
  fetchTransactions, createTransaction, updateTransaction,
  deleteTransaction, fetchAllTransactionsRaw,
} from './transactions.js';
import { fetchPriceCache, upsertPriceCache } from './prices.js';
import { getHoldings, getRealizedPnL } from './calculations.js';
import { fetchSinglePrice } from './market.js';
import { requireAuth, signOut, fetchProfile, updateProfile, getCurrentUser, onAuthStateChange } from './auth.js';
import { initAuthUI, showAuth, hideAuth } from './authUI.js';

/* 防抖 */
function debounce(callback, delay) {
  var timer = null;
  return function () {
    var args = arguments;
    var ctx = this;
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () { callback.apply(ctx, args); timer = null; }, delay);
  };
}

/* Toast */
function showToast(message, type) {
  if (!type) type = 'info';
  var container = document.getElementById('toastContainer');
  if (!container) return;
  var toast = document.createElement('div');
  toast.className = 'toast ' + type;
  var icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
  toast.innerHTML = '<i class="fas ' + (icons[type] || icons.info) + ' ' + type + '"></i> ' + message;
  container.appendChild(toast);
  setTimeout(function () {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    toast.style.transition = '0.3s ease';
    setTimeout(function () { toast.remove(); }, 300);
  }, 3000);
}

/* 格式化 */
function formatNumber(n, d) { if (d === undefined) d = 2; if (n == null || isNaN(n)) return '—'; return Number(n).toFixed(d); }
function formatCurrency(n) {
  if (n == null || isNaN(n)) return '$—';
  var prefix = n >= 0 ? '' : '-';
  var abs = Math.abs(n);
  var parts = abs.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return prefix + '$' + parts.join('.');
}
function formatPercent(n) { if (n == null || isNaN(n)) return '—'; return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'; }

/* 状态 */
var allTransactions = [];
var priceCache = {};
var editingId = null;
var currentType = 'buy';
var activeTab = 'holdings';
var pieChart = null;
var barChart = null;
var currentUser = null;

/* 用户 UI */
function updateUserMenu(user) {
  var menu = document.getElementById('userMenu');
  var avatar = document.getElementById('userAvatar');
  var nameEl = document.getElementById('userName');
  if (!menu || !avatar || !nameEl) return;

  if (user) {
    menu.style.display = 'inline-flex';
    avatar.src = user.user_metadata?.avatar_url || '';
    avatar.alt = user.email || '';
    nameEl.textContent = user.user_metadata?.full_name || user.email?.split('@')[0] || '用户';
  } else {
    menu.style.display = 'none';
  }
}

/* 初始化认证 */
async function initAuth() {
  initAuthUI();

  var user = await requireAuth();
  if (user) {
    currentUser = user;
    updateUserMenu(user);
    hideAuth();
    loadAllData();
  } else {
    showAuth(function () {
      // 登录回调：重新加载
      window.location.reload();
    });
  }

  // 监听 OAuth redirect 后的认证状态
  onAuthStateChange(function (event, session) {
    if (event === 'SIGNED_IN' && session?.user) {
      currentUser = session.user;
      updateUserMenu(session.user);
      hideAuth();
      loadAllData();
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      updateUserMenu(null);
      showAuth(function () { window.location.reload(); });
    }
  });
}

/* 数据加载 */
async function loadAllData() {
  try {
    var tx = await fetchTransactions();
    allTransactions = tx;
    var pc = await fetchPriceCache();
    priceCache = pc;
    refreshAll();
  } catch (err) {
    showToast('加载数据失败: ' + err.message, 'error');
  }
}

/* 退出登录 */
async function handleLogout() {
  if (!confirm('确定要退出登录吗？')) return;
  try {
    await signOut();
    window.location.reload();
  } catch (err) {
    showToast('退出失败: ' + err.message, 'error');
  }
}

/* 渲染 */
function refreshAll() {
  renderStats();
  renderCharts();
  renderHoldingsTable();
  renderTransactionsTable();
  renderRealizedTable();
  renderTabCounts();
  var el = document.getElementById('lastUpdate');
  if (el) { el.innerHTML = '<i class="far fa-clock"></i> ' + new Date().toLocaleString('zh-CN'); }
}

function renderStats() {
  var holdings = getHoldings(allTransactions, priceCache);
  var realized = getRealizedPnL(allTransactions);
  var totalInvested = holdings.reduce(function (s, h) { return s + h.totalCost; }, 0);
  var marketValue = holdings.reduce(function (s, h) { return s + h.marketValue; }, 0);
  var unrealizedPnl = holdings.reduce(function (s, h) { return s + h.unrealizedPnl; }, 0);
  var unrealizedPct = totalInvested > 0 ? (unrealizedPnl / totalInvested) * 100 : 0;
  var totalRealized = realized.reduce(function (s, r) { return s + r.realizedPnl; }, 0);
  var totalTx = realized.reduce(function (s, r) { return s + r.tradeCount; }, 0);

  setText('totalInvested', formatCurrency(totalInvested));
  setText('totalInvestedSub', '持有 ' + holdings.length + ' 支');
  setText('marketValue', formatCurrency(marketValue));
  setText('marketValueSub', holdings.length > 0 ? formatCurrency(marketValue / holdings.length) + ' / 支' : '—');

  var ue = document.getElementById('unrealizedPnl');
  if (ue) { ue.textContent = formatCurrency(unrealizedPnl); ue.className = 'stat-value ' + (unrealizedPnl >= 0 ? 'green' : 'red'); }
  var up = document.getElementById('unrealizedPnlPct');
  if (up) { up.textContent = formatPercent(unrealizedPct); up.style.color = unrealizedPct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'; }
  var re = document.getElementById('realizedPnl');
  if (re) { re.textContent = formatCurrency(totalRealized); re.className = 'stat-value ' + (totalRealized >= 0 ? 'green' : 'red'); }
  setText('realizedPnlCount', totalTx + ' 笔交易');
}

function setText(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }

function renderCharts() {
  var holdings = getHoldings(allTransactions, priceCache);
  var pieCtx = document.getElementById('pieChart');
  var barCtx = document.getElementById('barChart');
  if (!pieCtx || !barCtx) return;
  if (pieChart) { pieChart.destroy(); pieChart = null; }
  if (barChart) { barChart.destroy(); barChart = null; }
  if (holdings.length === 0) return;

  var pieLabels = holdings.map(function (h) { return h.name + ' (' + h.ticker + ')'; });
  var pieData = holdings.map(function (h) { return h.marketValue; });
  var pieColors = holdings.map(function (_, i) { return 'hsl(' + ((i * 137.508) % 360) + ', 65%, 55%)'; });

  pieChart = new Chart(pieCtx.getContext('2d'), {
    type: 'doughnut',
    data: { labels: pieLabels, datasets: [{ data: pieData, backgroundColor: pieColors, borderColor: '#111827', borderWidth: 2, hoverOffset: 8 }] },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: {
        legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 11 }, padding: 10, usePointStyle: true, pointStyle: 'circle' } },
        tooltip: { backgroundColor: '#1a1f2e', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: '#2a3145', borderWidth: 1, padding: 10,
          callbacks: { label: function (ctx) { var t = ctx.dataset.data.reduce(function (a, b) { return a + b; }, 0); return ' ' + formatCurrency(ctx.raw) + '  (' + (t > 0 ? ((ctx.raw / t) * 100).toFixed(1) : 0) + '%)'; } }
        },
      },
    },
  });

  var barLabels = holdings.map(function (h) { return h.name + ' (' + h.ticker + ')'; });
  var barData = holdings.map(function (h) { return h.unrealizedPnl; });
  var barColors = barData.map(function (v) { return v >= 0 ? '#10b981' : '#ef4444'; });

  barChart = new Chart(barCtx.getContext('2d'), {
    type: 'bar',
    data: { labels: barLabels, datasets: [{ label: '未实现盈亏 ($)', data: barData, backgroundColor: barColors, borderRadius: 4, borderSkipped: false }] },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#1a1f2e', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: '#2a3145', borderWidth: 1, padding: 10, callbacks: { label: function (ctx) { return ' ' + formatCurrency(ctx.raw); } } },
      },
      scales: {
        x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(42,49,69,0.3)' } },
        y: { ticks: { color: '#64748b', font: { size: 11 }, callback: function (v) { return formatCurrency(v); } }, grid: { color: 'rgba(42,49,69,0.3)' } },
      },
    },
  });
}

function renderHoldingsTable() {
  var tbody = document.getElementById('holdingsBody');
  var empty = document.getElementById('emptyHoldings');
  if (!tbody || !empty) return;
  var search = document.getElementById('searchInput');
  var query = search ? search.value.trim().toLowerCase() : '';

  var holdings = getHoldings(allTransactions, priceCache);
  if (query) { holdings = holdings.filter(function (h) { return h.name.toLowerCase().includes(query) || h.ticker.toLowerCase().includes(query); }); }
  if (holdings.length === 0) { tbody.innerHTML = ''; empty.classList.add('active'); return; }
  empty.classList.remove('active');

  var html = '';
  for (var i = 0; i < holdings.length; i++) {
    var h = holdings[i];
    var cls = h.unrealizedPnl >= 0 ? 'green' : 'red';
    var pctCls = h.unrealizedPct >= 0 ? 'green' : 'red';
    var exch = h.exchange.toUpperCase();
    var exchCls = exch.toLowerCase();
    var statusHtml = '';
    if (h.priceAge < 3600) { statusHtml = '<span class="fetch-status ok"><i class="fas fa-circle status-dot"></i> 实时</span>'; }
    else if (h.priceAge < 86400) { statusHtml = '<span class="fetch-status stale"><i class="fas fa-clock"></i> ' + Math.round(h.priceAge / 3600) + 'h前</span>'; }
    else if (h.currentPrice > 0) { statusHtml = '<span class="fetch-status stale"><i class="fas fa-clock"></i> 旧数据</span>'; }
    else { statusHtml = '<span class="fetch-status error"><i class="fas fa-times"></i> 无行情</span>'; }

    html += '<tr>' +
      '<td>' + h.name + '</td>' +
      '<td><span class="ticker-tag">' + h.ticker + '</span></td>' +
      '<td><span class="exchange-badge ' + exchCls + '">' + exch + '</span></td>' +
      '<td><span class="num">' + formatNumber(h.heldShares, 2) + '</span></td>' +
      '<td><span class="num">' + formatCurrency(h.avgCost) + '</span></td>' +
      '<td><span class="price-edit"><span class="num">' + (h.currentPrice > 0 ? formatCurrency(h.currentPrice) : '—') + '</span>' + statusHtml + '</span></td>' +
      '<td><span class="num">' + formatCurrency(h.marketValue) + '</span></td>' +
      '<td><span class="num">' + formatCurrency(h.totalCost) + '</span></td>' +
      '<td><span class="num ' + cls + '">' + formatCurrency(h.unrealizedPnl) + '</span></td>' +
      '<td><span class="num ' + pctCls + '">' + formatPercent(h.unrealizedPct) + '</span></td>' +
      '<td><div class="action-cell"><button class="btn-icon edit" onclick="window.editPrice(\'' + h.ticker + '\')" title="修改现价"><i class="fas fa-dollar-sign"></i></button></div></td>' +
      '</tr>';
  }
  tbody.innerHTML = html;
}

function renderTransactionsTable() {
  var tbody = document.getElementById('transactionsBody');
  var empty = document.getElementById('emptyTx');
  if (!tbody || !empty) return;
  var search = document.getElementById('searchInput');
  var query = search ? search.value.trim().toLowerCase() : '';

  var tx = allTransactions.slice().sort(function (a, b) { return (b.date || '') < (a.date || '') ? -1 : 1; });
  if (query) { tx = tx.filter(function (t) { return (t.name || '').toLowerCase().includes(query) || (t.ticker || '').toLowerCase().includes(query); }); }
  if (tx.length === 0) { tbody.innerHTML = ''; empty.classList.add('active'); return; }
  empty.classList.remove('active');

  var html = '';
  for (var i = 0; i < tx.length; i++) {
    var t = tx[i];
    var typeCls = t.type === 'buy' ? 'buy' : 'sell';
    var typeIcon = t.type === 'buy' ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
    var typeLabel = t.type === 'buy' ? '买入' : '卖出';
    var exch = (t.exchange || 'NASDAQ').toUpperCase();
    var exchCls = exch.toLowerCase();
    var totalAmount = t.type === 'buy' ? t.shares * t.price + (t.fee || 0) : t.shares * t.price - (t.fee || 0);

    html += '<tr>' +
      '<td>' + (t.date || '—') + '</td>' +
      '<td><span class="badge-type ' + typeCls + '"><i class="fas ' + typeIcon + '"></i> ' + typeLabel + '</span></td>' +
      '<td>' + t.name + '</td>' +
      '<td><span class="ticker-tag">' + t.ticker + '</span></td>' +
      '<td><span class="exchange-badge ' + exchCls + '">' + exch + '</span></td>' +
      '<td><span class="num">' + t.shares + '</span></td>' +
      '<td><span class="num">' + formatCurrency(t.price) + '</span></td>' +
      '<td><span class="num">' + formatCurrency(t.fee || 0) + '</span></td>' +
      '<td><span class="num">' + formatCurrency(totalAmount) + '</span></td>' +
      '<td>' + (t.note || '—') + '</td>' +
      '<td><div class="action-cell">' +
        '<button class="btn-icon edit" onclick="window.editTx(\'' + t.id + '\')" title="编辑"><i class="fas fa-pen"></i></button>' +
        '<button class="btn-icon del" onclick="window.deleteTx(\'' + t.id + '\')" title="删除"><i class="fas fa-trash"></i></button>' +
      '</div></td>' +
      '</tr>';
  }
  tbody.innerHTML = html;
}

function renderRealizedTable() {
  var tbody = document.getElementById('realizedBody');
  var empty = document.getElementById('emptyRealized');
  if (!tbody || !empty) return;
  var realized = getRealizedPnL(allTransactions);
  if (realized.length === 0) { tbody.innerHTML = ''; empty.classList.add('active'); return; }
  empty.classList.remove('active');
  var html = '';
  for (var i = 0; i < realized.length; i++) {
    var r = realized[i];
    var cls = r.realizedPnl >= 0 ? 'green' : 'red';
    var pctCls = r.realizedPnl >= 0 ? 'green' : 'red';
    html += '<tr>' +
      '<td><span class="ticker-tag">' + r.ticker + '</span></td>' +
      '<td>' + r.name + '</td>' +
      '<td><span class="num">' + formatCurrency(r.totalBuy) + '</span></td>' +
      '<td><span class="num">' + formatCurrency(r.totalSell) + '</span></td>' +
      '<td><span class="num ' + cls + '">' + formatCurrency(r.realizedPnl) + '</span></td>' +
      '<td><span class="num ' + pctCls + '">' + formatPercent(r.ret) + '</span></td>' +
      '<td>' + r.tradeCount + '</td>' +
      '</tr>';
  }
  tbody.innerHTML = html;
}

function renderTabCounts() {
  var h = getHoldings(allTransactions, priceCache);
  var hc = document.getElementById('holdingsCount');
  var tc = document.getElementById('txCount');
  if (hc) { hc.textContent = h.length; hc.className = 'badge' + (h.length > 0 ? ' green' : ''); }
  if (tc) tc.textContent = allTransactions.length;
}

/* 交易 CRUD */
function openModal(tx) {
  if (!tx) tx = null;
  editingId = tx ? tx.id : null;
  setText('modalTitle', tx ? '编辑交易' : '记一笔交易');
  setText('modalSub', tx ? '修改交易信息' : '记录买入或卖出操作');

  var fName = document.getElementById('f_name');
  var fTicker = document.getElementById('f_ticker');
  var fExchange = document.getElementById('f_exchange');
  var fShares = document.getElementById('f_shares');
  var fPrice = document.getElementById('f_price');
  var fFee = document.getElementById('f_fee');
  var fDate = document.getElementById('f_date');
  var fNote = document.getElementById('f_note');

  if (fName) fName.value = tx ? tx.name : '';
  if (fTicker) fTicker.value = tx ? tx.ticker : '';
  if (fExchange) fExchange.value = tx ? (tx.exchange || 'NASDAQ') : 'NASDAQ';
  if (fShares) fShares.value = tx ? tx.shares : '';
  if (fPrice) fPrice.value = tx ? tx.price : '';
  if (fFee) fFee.value = tx ? (tx.fee || 0) : '';
  if (fDate) fDate.value = tx ? (tx.date || '') : '';
  if (fNote) fNote.value = tx ? (tx.note || '') : '';

  setType(tx ? tx.type : 'buy');
  var overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.classList.add('active');
}

function closeModal() {
  var overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.classList.remove('active');
  editingId = null;
}

function setType(type) {
  currentType = type;
  document.querySelectorAll('#typeToggle button').forEach(function (b) {
    b.className = '';
    if (b.dataset.type === type) b.className = type === 'buy' ? 'active-buy' : 'active-sell';
  });
}

async function saveTx() {
  var type = currentType;
  var fName = document.getElementById('f_name');
  var fTicker = document.getElementById('f_ticker');
  var fExchange = document.getElementById('f_exchange');
  var fShares = document.getElementById('f_shares');
  var fPrice = document.getElementById('f_price');
  var fFee = document.getElementById('f_fee');
  var fDate = document.getElementById('f_date');
  var fNote = document.getElementById('f_note');

  var name = fName ? fName.value.trim() : '';
  var ticker = fTicker ? fTicker.value.trim().toUpperCase() : '';
  var exchange = fExchange ? fExchange.value : 'NASDAQ';
  var shares = parseFloat(fShares ? fShares.value : '0');
  var price = parseFloat(fPrice ? fPrice.value : '0');
  var fee = parseFloat(fFee ? fFee.value : '0');
  var date = fDate ? fDate.value : '';
  var note = fNote ? fNote.value.trim() : '';

  if (!name) { showToast('请输入名称', 'error'); return; }
  if (!ticker) { showToast('请输入代码', 'error'); return; }
  if (!shares || shares <= 0) { showToast('请输入有效的股数', 'error'); return; }
  if (!price || price <= 0) { showToast('请输入有效的成交价', 'error'); return; }

  try {
    if (editingId) {
      await updateTransaction(editingId, { type: type, ticker: ticker, name: name, exchange: exchange, shares: shares, price: price, fee: fee, date: date, note: note });
      showToast('交易已更新', 'success');
    } else {
      await createTransaction({ type: type, ticker: ticker, name: name, exchange: exchange, shares: shares, price: price, fee: fee, date: date, note: note });
      showToast((type === 'buy' ? '买入' : '卖出') + ' ' + ticker + ' 已记录', 'success');
    }
    allTransactions = await fetchTransactions();
    refreshAll();
    closeModal();
  } catch (err) {
    showToast('保存失败: ' + err.message, 'error');
  }
}

async function onDeleteTx(id) {
  var tx = null;
  for (var i = 0; i < allTransactions.length; i++) { if (allTransactions[i].id === id) { tx = allTransactions[i]; break; } }
  if (!tx) return;
  var typeLabel = tx.type === 'buy' ? '买入' : '卖出';
  if (!confirm('确定要删除「' + typeLabel + ' ' + tx.ticker + ' ' + tx.shares + '股」的记录吗？')) return;
  try {
    await deleteTransaction(id);
    allTransactions = await fetchTransactions();
    refreshAll();
    showToast('交易记录已删除', 'info');
  } catch (err) { showToast('删除失败: ' + err.message, 'error'); }
}

function onEditTx(id) {
  var tx = null;
  for (var i = 0; i < allTransactions.length; i++) { if (allTransactions[i].id === id) { tx = allTransactions[i]; break; } }
  if (tx) openModal(tx);
}

async function onEditPrice(ticker) {
  var current = priceCache[ticker] ? priceCache[ticker].price : 0;
  var input = prompt('输入 ' + ticker + ' 的当前价 ($):', current > 0 ? current.toFixed(2) : '');
  if (input === null) return;
  var val = parseFloat(input);
  if (isNaN(val) || val <= 0) { showToast('请输入有效价格', 'error'); return; }
  priceCache[ticker] = { price: val, ts: Date.now() };
  try {
    await upsertPriceCache({ [ticker]: { price: val, ts: Date.now() } });
    refreshAll();
    showToast(ticker + ' 价格已更新', 'success');
  } catch (err) { showToast('价格更新失败: ' + err.message, 'error'); }
}

/* 行情刷新 */
async function refreshAllPrices() {
  var btn = document.getElementById('btnRefresh');
  if (!btn) return;
  btn.classList.add('loading');
  var holdings = getHoldings(allTransactions, priceCache);
  var tickers = holdings.map(function (h) { return h.ticker; });
  if (tickers.length === 0) { showToast('没有持仓需要刷新行情', 'info'); btn.classList.remove('loading'); return; }

  var updatedCache = {};
  var success = 0;
  var failDetails = [];
  for (var i = 0; i < tickers.length; i += 5) {
    var batch = tickers.slice(i, i + 5);
    var results = await Promise.all(batch.map(function (t) {
      return fetchSinglePrice(t).then(function (price) {
        return { ticker: t, price: price };
      }).catch(function (err) {
        failDetails.push(t + ': ' + err.message);
        return null;
      });
    }));
    for (var j = 0; j < batch.length; j++) {
      var r = results[j];
      if (r && r.price && r.price.price > 0) {
        updatedCache[r.ticker] = { price: r.price.price, ts: Date.now() };
        success++;
      }
    }
  }
  if (Object.keys(updatedCache).length > 0) {
    Object.assign(priceCache, updatedCache);
    try { await upsertPriceCache(updatedCache); } catch (err) { console.error('[TradeTracker] 价格缓存写入失败:', err.message); }
  }
  btn.classList.remove('loading');
  if (success > 0) { showToast('已刷新 ' + success + '/' + tickers.length + ' 支行情', 'success'); }
  else { showToast('行情刷新失败\n' + failDetails.join('\n'), 'error'); }
  refreshAll();
}

/* 导出 */
function exportCSV() {
  if (allTransactions.length === 0) { showToast('没有数据可导出', 'error'); return; }
  var headers = ['类型', '名称', '代码', '交易所', '股数', '成交价', '税费', '成交总额', '日期', '备注'];
  var rows = allTransactions.map(function (t) {
    var totalAmount = t.type === 'buy' ? t.shares * t.price + (t.fee || 0) : t.shares * t.price - (t.fee || 0);
    return [t.type === 'buy' ? '买入' : '卖出', t.name, t.ticker, t.exchange || 'NASDAQ', t.shares, t.price, (t.fee || 0).toFixed(2), totalAmount.toFixed(2), t.date || '', t.note || ''];
  });
  var csvContent = [headers.join(','), rows.map(function (r) { return r.join(','); }).join('\n')].join('\n');
  var blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'trades_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('交易记录已导出为 CSV', 'success');
}

/* 暴露到 window 供 onclick */
window.editPrice = onEditPrice;
window.editTx = onEditTx;
window.deleteTx = onDeleteTx;

/* 启动 */
document.addEventListener('DOMContentLoaded', function () {
  // Tab 切换
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      document.querySelectorAll('.table-wrapper').forEach(function (w) { w.classList.remove('active'); });
      var target = document.getElementById('tab-' + btn.dataset.tab);
      if (target) target.classList.add('active');
      activeTab = btn.dataset.tab;
    });
  });

  // 类型切换
  document.querySelectorAll('#typeToggle button').forEach(function (btn) {
    btn.addEventListener('click', function () { setType(btn.dataset.type); });
  });

  // 按钮事件
  var btnAdd = document.getElementById('btnAdd');
  var btnRefresh = document.getElementById('btnRefresh');
  var btnExport = document.getElementById('btnExport');
  var btnSave = document.getElementById('btnSave');
  var btnCancel = document.getElementById('btnCancel');
  var btnLogout = document.getElementById('btnLogout');

  if (btnAdd) btnAdd.addEventListener('click', debounce(function () { openModal(null); }, 300));
  if (btnRefresh) btnRefresh.addEventListener('click', debounce(refreshAllPrices, 500));
  if (btnExport) btnExport.addEventListener('click', debounce(exportCSV, 300));
  if (btnSave) btnSave.addEventListener('click', debounce(saveTx, 300));
  if (btnCancel) btnCancel.addEventListener('click', debounce(closeModal, 200));
  if (btnLogout) btnLogout.addEventListener('click', debounce(handleLogout, 300));

  // 点击遮罩关闭
  var overlay = document.getElementById('modalOverlay');
  if (overlay) { overlay.addEventListener('click', function (e) { if (e.target === e.currentTarget) closeModal(); }); }

  // 搜索
  var searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(function () {
      if (activeTab === 'holdings') renderHoldingsTable();
      else if (activeTab === 'transactions') renderTransactionsTable();
    }, 200));
  }

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  // 启动认证流程
  initAuth();
});
