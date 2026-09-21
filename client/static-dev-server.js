/**
 * 后台静态产物本地镜像服务：模拟 Spring WebConfig 的资源优先级，
 * 用于在不动线上服务的前提下验证 server/api/src/main/resources/static 的改动。
 *
 * 规则与线上一致：
 * 1. /api/* 代理到 BACKEND_URL（默认 http://www.dxx.zone:1991）；
 * 2. *.css/*.js/*.jpg/*.png/*.svg/*.webp/*.eot/*.ttf/*.woff/favicon.ico → static/ 目录文件；
 * 3. 其余 GET（SPA 路由）→ static/index.html。
 *
 * 用法：node client/static-dev-server.js  → http://127.0.0.1:4174/user/login
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const port = Number(process.env.PORT || 4174);
const remote = new URL(process.env.BACKEND_URL || 'http://www.dxx.zone:1991');
const staticDir = path.resolve(__dirname, '../server/api/src/main/resources/static');

// 与 WebConfig.STATIC_RESOURCES 保持一致的扩展名白名单
const STATIC_EXT = new Set(['.css', '.js', '.jpg', '.png', '.svg', '.webp', '.eot', '.ttf', '.woff']);
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.ico': 'image/x-icon',
};

function sendFile(filePath, response) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
    response.end(content);
  });
}

function serveStatic(request, response) {
  const parsedUrl = new URL(request.url, `http://${request.headers.host}`);
  const requestPath = decodeURIComponent(parsedUrl.pathname);

  const isStaticPattern = STATIC_EXT.has(path.extname(requestPath)) || requestPath === '/favicon.ico';
  if (isStaticPattern) {
    const filePath = path.join(staticDir, requestPath);
    if (filePath.startsWith(staticDir) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      sendFile(filePath, response);
      return;
    }
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  // SPA 回退：其余 GET 一律返回 index.html（等同 WebConfig 的兜底 @GetMapping）
  sendFile(path.join(staticDir, 'index.html'), response);
}

function proxyApi(request, response) {
  const headers = { ...request.headers, host: remote.host };
  delete headers.origin;
  delete headers.referer;
  const proxyRequest = http.request({
    hostname: remote.hostname,
    port: remote.port || 80,
    method: request.method,
    path: request.url,
    headers,
  }, (proxyResponse) => {
    const responseHeaders = { ...proxyResponse.headers };
    if (responseHeaders['set-cookie']) {
      responseHeaders['set-cookie'] = responseHeaders['set-cookie'].map((cookie) => cookie.replace(/;\s*Domain=[^;]+/i, ''));
    }
    response.writeHead(proxyResponse.statusCode, responseHeaders);
    proxyResponse.pipe(response);
  });
  proxyRequest.on('error', () => {
    response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ message: `后台代理不可用：${remote.href}` }));
  });
  request.pipe(proxyRequest);
}

http.createServer((request, response) => {
  if (request.url.startsWith('/api/')) {
    proxyApi(request, response);
  } else {
    serveStatic(request, response);
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`SurveyKing static mirror: http://127.0.0.1:${port}`);
  console.log(`API proxy: ${remote.href}`);
});
