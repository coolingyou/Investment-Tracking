/**
 * Vercel Serverless Function -- Stock price proxy
 * 优先使用 Finnhub（需配置 FINNHUB_API_KEY 环境变量）
 * 降级使用 Yahoo Finance
 * Frontend calls: /api/quote?ticker=AAPL
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  var ticker = req.query.ticker;
  if (!ticker) {
    return res.status(400).json({ error: 'Missing ticker parameter' });
  }

  var apiKey = process.env.FINNHUB_API_KEY || '';

  try {
    // 方案一：Finnhub（如有配置 key）
    if (apiKey) {
      var finnhubUrl = 'https://finnhub.io/api/v1/quote?symbol=' +
        encodeURIComponent(ticker.toUpperCase()) + '&token=' + apiKey;

      var fr = await fetch(finnhubUrl, { headers: { 'Accept': 'application/json' } });

      if (fr.ok) {
        var fd = await fr.json();
        if (fd && fd.c !== undefined && fd.c !== null && fd.c > 0) {
          return res.status(200).json({
            chart: {
              result: [{
                meta: {
                  regularMarketPrice: fd.c,
                  currency: 'USD',
                  symbol: ticker.toUpperCase(),
                  instrumentType: 'EQUITY',
                },
              }],
            },
          });
        }
      }
    }

    // 方案二：Yahoo Finance（降级）
    var ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    var r1 = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker) + '?range=1d&interval=1d', {
      headers: { 'User-Agent': ua, 'Accept': 'application/json' },
    });
    if (r1.ok) {
      var d1 = await r1.json();
      if (d1 && d1.chart && d1.chart.result && d1.chart.result[0]) {
        return res.status(200).json(d1);
      }
    }

    var r2 = await fetch('https://query2.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker) + '?range=1d&interval=1d', {
      headers: { 'User-Agent': ua, 'Accept': 'application/json' },
    });
    if (r2.ok) {
      var d2 = await r2.json();
      if (d2 && d2.chart && d2.chart.result && d2.chart.result[0]) {
        return res.status(200).json(d2);
      }
    }

    // Fallback: cookie/crumb
    var cookieRes = await fetch('https://fc.yahoo.c