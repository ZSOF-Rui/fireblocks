// FireBlocks 局域网联机服务：静态托管 dist/ + WebSocket 房间中继
// 用法: node server.mjs （或双击根目录 lan-play.bat）
import http from 'node:http';
import os from 'node:os';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');
const PORT = Number(process.env.PORT || 8788);

if (!existsSync(join(dist, 'index.html'))) {
  console.error('[失败] 未找到 dist/ 构建产物，请先在根目录运行 build.bat（或 npm run build）。');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let p = normalize(url.pathname).replace(/^[/\\]+/, '');
  if (p === '') p = 'index.html';
  const file = join(dist, p);
  if (!file.startsWith(dist) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
    res.end(readFileSync(join(dist, 'index.html')));
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(file));
});

const wss = new WebSocketServer({ noServer: true });
const rooms = new Map();

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname !== '/room') { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws) => {
    const code = (url.searchParams.get('code') || '').toUpperCase();
    const role = url.searchParams.get('role');
    if (!/^[A-Z0-9]{3,8}$/.test(code) || (role !== 'host' && role !== 'guest')) {
      ws.send(JSON.stringify({ t: 'err', msg: '无效的房间号' }));
      ws.close();
      return;
    }
    let room = rooms.get(code);
    if (role === 'host') {
      if (room?.host) { ws.send(JSON.stringify({ t: 'err', msg: '房间号已被占用，请重新创建' })); ws.close(); return; }
      if (!room) { room = { host: null, guest: null }; rooms.set(code, room); }
      room.host = ws;
      console.log(`[房间 ${code}] 主机已连接`);
    } else {
      if (!room?.host) { ws.send(JSON.stringify({ t: 'err', msg: '房间不存在或主机不在线' })); ws.close(); return; }
      if (room.guest) { ws.send(JSON.stringify({ t: 'err', msg: '房间已满' })); ws.close(); return; }
      room.guest = ws;
      console.log(`[房间 ${code}] 访客已连接`);
    }
    ws.on('message', (data) => {
      const other = ws === room.host ? room.guest : room.host;
      if (other && other.readyState === 1) other.send(String(data));
    });
    ws.on('close', () => {
      if (ws === room.host) room.host = null; else room.guest = null;
      const other = room.host || room.guest;
      if (other && other.readyState === 1) other.send(JSON.stringify({ t: 'bye' }));
      if (!room.host && !room.guest) rooms.delete(code);
      console.log(`[房间 ${code}] 一方断开`);
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('==============================================');
  console.log(' FireBlocks 局域网联机服务已启动');
  console.log('==============================================');
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) {
      if (i.family === 'IPv4' && !i.internal) console.log(`  局域网地址: http://${i.address}:${PORT}`);
    }
  }
  console.log(`  本机地址:   http://localhost:${PORT}`);
  console.log('');
  console.log(' 其他设备用浏览器打开上面的局域网地址，');
  console.log(' 进入「窗口 / 局域网对战」选择「局域网」，输入同一房间号即可对战。');
  console.log(' 按 Ctrl+C 停止服务。');
});