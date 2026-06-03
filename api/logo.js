/**
 * Vercel Serverless Function -- Logo 图片代理
 * 从 GitHub raw 加载 logo 图片
 * 前端: /api/logo
 */
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const logoPath = path.join(__dirname, '..', 'TT-logo-1.png');
  
  try {
    const data = fs.readFileSync(logoPath);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).end(data);
  } catch (e) {
    // 从 GitHub raw 获取
    const url = 'https://raw.githubusercontent.com/coolingyou/Investment-Tracking/main/TT-logo-1.png';
    const r = await fetch(url);
    const buf = await r.arrayBuffer();
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).end(Buffer.from(buf));
  }
}
