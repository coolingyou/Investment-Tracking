/**
 * 行情获取工具 —— 通过 Vercel Serverless API 获取实时报价
 * 优先使用 Finnhub，降级到 Yahoo Finance
 */

/**
 * 获取单支股票的实时价格
 * @param {string} ticker - 股票代码
 * @returns {Promise<{ price: number, currency: string }>}
 */
export async function fetchSinglePrice(ticker) {
  var url = '/api/quote?ticker=' + encodeURIComponent(ticker) + '&_=' + Date.now();
  var res = await fetch(url, { signal: AbortSignal.timeout(15000), cache: 'no-store' });
  var data = await res.json();

  var result = data && data.chart && data.chart.result && data.chart.result[0];
  if (result && result.meta && result.meta.regularMarketPrice !== undefined) {
    return {
      price: Number(result.meta.regularMarketPrice),
      currency: result.meta.currency || 'USD',
    };
  }

  if (data && data.chart && data.chart.error) {
    throw new Error('[TradeTracker] ' + ticker + ' ' + (data.chart.error.descrip