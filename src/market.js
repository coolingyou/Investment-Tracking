/**
 * 行情获取工具 —— 通过 Vercel Serverless API 获取实时报价
 * 优先使用 Finnhub，降级到 Yahoo Finance
 */

export async function fetchSinglePrice(ticker) {
  var baseUrl = window.location.protocol + '//' + window.location.host;
  var url = baseUrl + '/api/quote?ticker=' + encodeURIComponent(ticker) + '&_=' + Date.now();
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
    throw new Error('[TradeTracker] ' + ticker + ' Yahoo error: ' + (data.chart.error.description || data.chart.error.code));
  }

  throw new Error('[TradeTracker] ' + ticker + ' no price data (HTTP ' + res.status + ')');
}

export async function searchStock(query) {
  var baseUrl = window.location.protocol + '//' + window.location.host;
  var url = baseUrl + '/api/search?q=' + encodeURIComponent(query);
  var res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;

  var data = await res.json();
  var quotes = data && data.quotes;
  if (!quotes || quotes.length === 0) return null;

  var exchangeMap = { 'NMS': 'NASDAQ', 'NYQ': 'NYSE', 'ASE': 'AMEX', 'PCX': 'NYSE', 'BTS': 'NASDAQ' };
  for (var i = 0; i < quotes.length; i++) {
    var q = quotes[i];
    if (q.quoteType === 'EQUITY' || q.quoteType === 'ETF') {
      return { ticker: q.symbol, name: q.longname || q.shortname || q.symbol, exchange: exchangeMap[q.exchange] || q.exchange || 'NASDAQ' };
    }
  }
  return { ticker: quotes[0].symbol, name: quotes[0].longname || quotes[0].shortname || quotes[0].symbol, exchange: quotes[0].exchange || 'NASDAQ' };
}
