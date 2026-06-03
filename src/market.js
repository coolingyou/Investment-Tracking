export async function fetchSinglePrice(ticker) {
  // 加时间戳避免 Vercel/浏览器缓存
  var url = '/api/quote?ticker=' + encodeURIComponent(ticker) + '&_=' + Date.now();
  var res = await fetch(url, { signal: AbortSignal.timeout(15000), cache: 'no-store' });
  var data = await res.json();

  // 优先从 chart.result[0].meta 读取
  var result = data && data.chart && data.chart.result && data.chart.result[0];
  if (result && result.meta && result.meta.regularMarketPrice !== undefined) {
    return {
      price: Number(result.meta.regularMarketPrice),
      currency: result.meta.currency || 'USD',
    };
  }

  // 如果 Yahoo 返回 error，抛出具体信息
  if (data && data.chart && data.chart.error) {
    throw new Error('[TradeTracker] ' + ticker + ' Yahoo error: ' + (data.chart.error.description || data.chart.error.code));
  }

  throw new Error('[TradeTracker] ' + ticker + ' no price data (HTTP ' + res.status + ')');
}
