/**
 * Vercel Serverless Function -- Stock price proxy
 * 优先使用 Finnhub
 * 降级使用 Yahoo Finance
 * 当 ?ticker=logo 时重定向到 CDN 上的 logo 图片
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

  // 返回 logo 图片
  if (!ticker || ticker === 'logo') {
    try {
      var logoRes = await fetch('https://raw.githubusercontent.com/coolingyou/Investment-Tracking/main/TT-logo-1.png');
      if (logoRes.ok) {
        var text = await logoRes.text();
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.status(200).send(text);
      }
    } catch (e) {}
    res.setHeader('Location', 'https://raw.githubusercontent.com/coolingyou/Investment-Tracking/main/TT-logo-1.png');
    return res.status(302).end();
  }

  // 原始股票价格查询逻辑
  var apiKey = process.env.FINNHUB_API_KEY || '';

  try {
    if (apiKey) {
      var finnhubUrl = 'https://finnhub.io/api/v1/quote?symbol=' + encodeURIComponent(ticker.toUpperCase()) + '&token=' + apiKey;
      var fr = await fetch(finnhubUrl, { headers: { 'Accept': 'application/json' } });
      if (fr.ok) {
        var fd = await fr.json();
        if (fd && fd.c !== undefined && fd.c > 0) {
          return res.status(200).json({
            chart: { result: [{ meta: { regularMarketPrice: fd.c, currency: 'USD', symbol: ticker.toUpperCase(), instrumentType: 'EQUITY', dataSource: 'Finnhub' } }] },
          });
        }
      }
    }

    var ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    var r1 = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker) + '?range=1d&interval=1d', {
      headers: { 'User-Agent': ua, 'Accept': 'application/json' },
    });
    if (r1.ok) {
      var d1 = await r1.json();
      if (d1 && d1.chart && d1.chart.result && d1.chart.result[0]) {
        d1.chart.result[0].meta.dataSource = 'Yahoo Finance';
        return res.status(200).json(d1);
      }
    }

    var r2 = await fetch('https://query2.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker) + '?range=1d&interval=1d', {
      headers: { 'User-Agent': ua, 'Accept': 'application/json' },
    });
    if (r2.ok) {
      var d2 = await r2.json();
      if (d2 && d2.chart && d2.chart.result && d2.chart.result[0]) {
        d2.chart.result[0].meta.dataSource = 'Yahoo Finance (query2)';
        return res.status(200).json(d2);
      }
    }

    var cookieRes = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': ua } });
    var cookie = '';
    var sc = cookieRes.headers.get('set-cookie');
    if (sc) { cookie = sc.split(';')[0]; }

    var crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', { headers: { Cookie: cookie, 'User-Agent': ua } });
    var crumb = await crumbRes.text();

    var r3 = await fetch('https://query2.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker) + '?range=1d&interval=1d&crumb=' + encodeURIComponent(crumb), {
      headers: { Cookie: cookie, 'User-Agent': ua },
    });
    if (r3.ok) {
      var d3 = await r3.json();
      if (d3 && d3.chart && d3.chart