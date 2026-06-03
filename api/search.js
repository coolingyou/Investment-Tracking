/**
 * Vercel Serverless Function -- Yahoo Finance search proxy
 * Frontend calls: /api/search?q=Apple
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  var query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter' });
  }

  try {
    var apiRes = await fetch(
      'https://query1.finance.yahoo.com/v1/finance/search?q=' + encodeURIComponent(query) + '&quotesCount=5&newsCount=0',
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
    );
    if (!apiRes.ok) {
      return res.status(502).json({ error: 'Yahoo Search returned ' + apiRes.status });
    }
    return res.status(200).json(await apiRes.json());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
