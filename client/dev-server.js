const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const port = Number(process.env.PORT || 4173);
const remote = new URL(process.env.BACKEND_URL || 'http://www.dxx.zone:1991');
const root = path.resolve(__dirname, '..');
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
};

function serveFile(request, response) {
  const parsedUrl = new URL(request.url, `http://${request.headers.host}`);
  const requestPath = parsedUrl.pathname === '/' ? '/client/login/index.html' : parsedUrl.pathname;

  if (requestPath === '/logo.svg') {
    const logoPath = path.resolve(root, 'server/api/src/main/resources/static/logo.svg');
    if (fs.existsSync(logoPath)) {
      response.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      fs.createReadStream(logoPath).pipe(response);
      return;
    }
  }

  const routeFallbacks = {
    '/user/login': '/client/login/index.html',
    '/home': '/client/home/index.html',
    '/project': '/client/project/index.html',
    '/exercise': '/client/exercise/index.html',
    '/repo': '/client/repo/index.html',
    '/repo/index': '/client/repo/index.html',
    '/repo/template': '/client/repo/index.html',
    '/repo/book': '/client/repo/index.html',
    '/template': '/client/template/index.html',
    '/system': '/client/system/index.html',
    '/system/user': '/client/system/index.html',
    '/system/role': '/client/system/index.html',
    '/system/dept': '/client/system/index.html',
    '/system/position': '/client/system/index.html',
    '/system/dict': '/client/system/index.html',
    '/system/setting': '/client/system/index.html',
  };

  let resolvedPath = routeFallbacks[requestPath];

  if (!resolvedPath) {
    const referer = request.headers.referer ? new URL(request.headers.referer).pathname : '';
    const refererParts = referer.split('/').filter(Boolean);
    const refererSection = refererParts[0] === 'user' ? 'login' : refererParts[0];

    if (requestPath.startsWith('/user/')) {
      resolvedPath = `/client/login/${requestPath.slice('/user/'.length)}`;
    } else if (requestPath.startsWith('/survey/')) {
      const sub = requestPath.slice('/survey/'.length);
      if (sub.endsWith('.js') || sub.endsWith('.css') || sub.endsWith('.png') || sub.endsWith('.svg')) {
        resolvedPath = `/client/survey/${path.basename(requestPath)}`;
      } else {
        resolvedPath = '/client/survey/index.html';
      }
    } else if (requestPath.startsWith('/client/')) {
      resolvedPath = requestPath;
    } else if (requestPath.startsWith('/shared/')) {
      resolvedPath = `/client/shared/${requestPath.slice('/shared/'.length)}`;
    } else if (['styles.css', 'main.js', 'system.css', 'survey.css'].includes(requestPath.replace(/^\//, '')) && ['home', 'project', 'exercise', 'repo', 'template', 'system', 'login', 'survey'].includes(refererSection)) {
      resolvedPath = `/client/${refererSection}${requestPath}`;
    } else {
      const parts = requestPath.split('/').filter(Boolean);
      const section = parts[0];
      if (['login', 'home', 'project', 'exercise', 'repo', 'template', 'system', 'survey'].includes(section)) {
        if (parts.length === 1) {
          resolvedPath = `/client/${section}/index.html`;
        } else {
          resolvedPath = `/client/${section}/${parts.slice(1).join('/')}`;
        }
      } else if (parts[parts.length - 1]?.includes('.')) {
        resolvedPath = `/client/${parts.join('/')}`;
      } else {
        resolvedPath = routeFallbacks[`/${parts[0]}`] || requestPath;
      }
    }
  }

  const relativePath = resolvedPath.replace(/^\//, '');
  const filePath = path.resolve(root, relativePath);
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(response);
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
    serveFile(request, response);
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`SurveyKing client: http://127.0.0.1:${port}`);
  console.log(`API proxy: ${remote.href}`);
});