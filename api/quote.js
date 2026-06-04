/**
 * Vercel Serverless Function -- Stock price & logo proxy
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  var ticker = req.query.ticker;

  // Logo request - direct proxy, no redirect
  if (!ticker || ticker === 'logo') {
    try {
      var logoUrl = 'https://cdn.jsdelivr.net/gh/coolingyou/Investment-Tracking@main/TT-logo-1.png';
      var r = await fetch(logoUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!r.ok) throw new Error('Fetch failed');
      var buf = await r.arrayBuffer();
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.status(200).end(Buffer.from(buf));
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  var apiKey = process.env.FINNHUB_API_KEY || '';
  try {
    if (apiKey) {
      var fr = await fetch('https://finnhub.io/api/v1/quote?symbol=' + encodeURIComponent(ticker) + '&token=' + apiKey, { headers: { Accept: 'application/json' } });
      if (fr.ok) {
        var fd = await fr.json();
        if (fd && fd.c > 0) return res.status(200).json({ chart: { result: [{ meta: { regularMarketPrice: fd.c, currency: 'USD', symbol: ticker, instrumentType: 'EQUITY', dataSource: 'Finnhub' } }] } });
      }
    }
    var ua = 'Mozilla/5.0';
    var r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker) + '?range=1d&interval=1d', { headers: { 'User-Agent': ua, Accept: 'application/json' } });
    if (r.ok) { var d = await r.json(); if (d && d.chart && d.chart.result && d.chart.result[0]) { d.chart.result[0].meta.dataSource = 'Yahoo'; return res.status(200).json(d); } }
    var r2 = await fetch('https://query2.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker) + '?range=1d&interval=1d', { headers: { 'User-Agent': ua, Accept: 'application/json' } });
    if (r2.ok) { var d2 = await r2.json(); if (d2 && d2.chart && d2.chart.result && d2.chart.result[0]) { d2.chart.result[0].meta.dataSource = 'Yahoo2'; return res.status(200).json(d2); } }
    return res.status(502).json({ error: 'Sources failed for ' + ticker });
  } catch (err) { return res.status(500).json({ error: err.message }); }
}
