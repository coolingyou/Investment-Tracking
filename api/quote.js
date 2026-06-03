/**
 * Vercel Serverless Function -- Yahoo Finance quote proxy
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

  try {
    var ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    // 尝试 query1
    var r1 = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker) + '?range=1d&interval=1d', {
      headers: { 'User-Agent': ua, 'Accept': 'application/json' },
    });
    if (r1.ok) {
      var d1 = await r1.json();
      if (d1 && d1.chart && d1.chart.result && d1.chart.result[0]) {
        return res.status(200).json(d1);
      }
    }

    // 尝试 query2
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
    var cookieRes = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': ua } });
    var cookie = '';
    var sc = cookieRes.headers.get('set-cookie');
    if (sc) { cookie = sc.split(';')[0]; }

    var crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: { Cookie: cookie, 'User-Agent': ua },
    });
    var crumb = await crumbRes.text();

    var r3 = await fetch('https://query2.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker) + '?range=1d&interval=1d&crumb=' + encodeURIComponent(crumb), {
      headers: { Cookie: cookie, 'User-Agent': ua },
    });
    if (r3.ok) {
      var d3 = await r3.json();
      if (d3 && d3.chart && d3.chart.result && d3.chart.result[0]) {
        return res.status(200).json(d3);
      }
    }

    return res.status(502).json({ error: 'Yahoo Finance returned ' + r3.status + ' for ' + ticker });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
