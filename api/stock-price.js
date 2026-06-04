/**
 * Vercel Serverless Function -- Finnhub quote proxy
 * 免费版限制：60次/分钟，约30次/秒
 * 前端通过 /api/stock-price?ticker=AAPL 调用
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
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

  // Finnhub API key（免费注册：https://finnhub.io/register）
  // 生产环境建议放到 Vercel Environment Variables 中
  var apiKey = process.env.FINNHUB_API_KEY || '';

  try {
    // 方式一：Finnhub API
    if (apiKey) {
      var finnhubUrl = 'https://finnhub.io/api/v1/quote?symbol=' +
        encodeURIComponent(ticker.toUpperCase()) + '&token=' + apiKey;

      var fr = await fetch(finnhubUrl, {
        headers: { 'Accept': 'application/json' },
      });

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
                  previousClose: fd.pc,
                  dayHigh: fd.h,
                  dayLow: fd.l,
                  dayOpen: fd.o,
                  change: fd.d,
                  changePercent: fd.dp,
                  instrumentType: 'EQUITY',
                },
              }],
            },
          });
        }
      }
    }

    // 方式二：降级到 Yahoo Finance（当 Finnhub key 未配置或失败时）
    var ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    var yahooUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/' +
      encodeURIComponent(ticker) + '?range=1d&interval=1d';

    var yr = await fetch(yahooUrl, {
      headers: { 'User-Agent': ua, 'Accept': 'application/json' },
    });

    if (yr.ok) {
      var yd = await yr.json();
      if (yd && yd.chart && yd.chart.result && yd.chart.result[0]) {
        return res.status(200).json(yd);
      }
    }

    // 两种方式都失败
    return res.status(502).json({
      error: 'Failed to fetch price for ' + ticker,
      hint: 'Configure FINNHUB_API_KEY in Vercel env vars for better reliability',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
