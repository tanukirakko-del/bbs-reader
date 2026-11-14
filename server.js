// ゆうめい専用ブラウザ（仮） - 5ch 読み取り専用ビューア
// 依存ライブラリなし。Node.js 標準機能だけで動作します。
// 通信先は 5ch 系サーバー（*.5ch.net / *.5ch.io / *.bbspink.com）のみ。
// それ以外の外部通信は一切しません。
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8787;
const HOST = '127.0.0.1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const ALLOWED_HOST = /\.(5ch\.net|5ch\.io|bbspink\.com)$/i;

const sjis = new TextDecoder('shift_jis');

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const buf = await res.arrayBuffer();
  return sjis.decode(buf);
}

function checkHost(host) {
  if (!host || !ALLOWED_HOST.test(host)) throw new Error('許可されていないホストです: ' + host);
  return host;
}

// ---------- 板一覧 ----------
let boardsCache = { at: 0, data: null };
async function getBoards() {
  if (boardsCache.data && Date.now() - boardsCache.at < 10 * 60 * 1000) return boardsCache.data;
  const html = await fetchText('https://menu.5ch.net/bbsmenu.html');
  const cats = [];
  let current = { category: 'その他', boards: [] };
  cats.push(current);
  const tokenRe = /<B>([^<]+)<\/B>|<A HREF=(https?:\/\/[^\s>]+)>([^<]+)<\/A>/gi;
  let m;
  while ((m = tokenRe.exec(html)) !== null) {
    if (m[1]) {
      current = { category: m[1].trim(), boards: [] };
      cats.push(current);
    } else if (m[2] && m[3]) {
      try {
        const u = new URL(m[2]);
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts.length >= 1 && ALLOWED_HOST.test(u.hostname)) {
          current.boards.push({ name: m[3].trim(), host: u.hostname, board: parts[0] });
        }
      } catch (e) { /* ignore bad url */ }
    }
  }
  const data = cats.filter(c => c.boards.length > 0);
  boardsCache = { at: Date.now(), data };
  return data;
}

// ---------- スレ一覧 ----------
async function getSubject(host, board) {
  checkHost(host);
  const txt = await fetchText(`https://${host}/${board}/subject.txt`);
  const out = [];
  for (const line of txt.split(/\r?\n/)) {
    const mm = line.match(/^(\d+)\.dat<>(.*)\s*\((\d+)\)\s*$/);
    if (mm) out.push({ key: mm[1], title: mm[2], count: parseInt(mm[3], 10) });
  }
  return out;
}

// ---------- DAT 解析 ----------
function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

function cleanBody(raw) {
  let s = raw.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<[^>]*>/g, '');
  return decodeEntities(s).trim();
}

function parseDat(txt) {
  const posts = [];
  const lines = txt.split(/\r?\n/).filter(l => l.length > 0);
  lines.forEach((line, i) => {
    const f = line.split('<>');
    const dateField = f[2] || '';
    const idm = dateField.match(/ID:(\S+)/);
    posts.push({
      num: i + 1,
      name: decodeEntities((f[0] || '').replace(/<[^>]*>/g, '')),
      mail: f[1] || '',
      date: dateField.replace(/\s*ID:\S+/, '').trim(),
      id: idm ? idm[1] : '',
      body: cleanBody(f[3] || ''),
      title: i === 0 ? decodeEntities(f[4] || '') : undefined,
    });
  });
  return posts;
}

async function getThread(host, board, key) {
  checkHost(host);
  if (!/^\d{9,10}$/.test(key)) throw new Error('スレッドキーが不正です');
  // まず現行DAT
  try {
    const txt = await fetchText(`https://${host}/${board}/dat/${key}.dat`);
    return { source: 'live', posts: parseDat(txt) };
  } catch (e) { /* 過去ログへ */ }
  // 過去ログ（kako）の標準パス
  const k4 = key.slice(0, 4), k5 = key.slice(0, 5);
  const txt = await fetchText(`https://${host}/${board}/kako/${k4}/${k5}/${key}.dat`);
  return { source: 'kako', posts: parseDat(txt) };
}

// ---------- HTTP サーバー ----------
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${HOST}:${PORT}`);
  const send = (code, obj, type) => {
    const body = type === 'text' ? obj : JSON.stringify(obj);
    res.writeHead(code, { 'Content-Type': (type === 'text' ? 'text/html' : 'application/json') + '; charset=utf-8' });
    res.end(body);
  };
  try {
    if (u.pathname === '/' || u.pathname === '/index.html') {
      const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
      return send(200, html, 'text');
    }
    if (u.pathname === '/api/boards') return send(200, await getBoards());
    if (u.pathname === '/api/subject') {
      return send(200, await getSubject(u.searchParams.get('host'), u.searchParams.get('board')));
    }
    if (u.pathname === '/api/thread') {
      return send(200, await getThread(u.searchParams.get('host'), u.searchParams.get('board'), u.searchParams.get('key')));
    }
    return send(404, { error: 'not found' });
  } catch (e) {
    return send(502, { error: String(e.message || e) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`専用ブラウザ起動中: http://${HOST}:${PORT}/`);
  console.log('終了するには このウィンドウで Ctrl+C を押してください');
});
