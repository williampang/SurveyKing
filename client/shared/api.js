const queryApiBase = new URLSearchParams(window.location.search).get('apiBase');
const savedApiBase = window.localStorage.getItem('surveyking-api-base');
const configuredBase = queryApiBase || savedApiBase || window.location.origin;

export const API_BASE = configuredBase.replace(/\/$/, '');

if (queryApiBase) {
  window.localStorage.setItem('surveyking-api-base', API_BASE);
}

function getErrorMessage(payload, fallback) {
  if (typeof payload === 'string' && payload) return payload;
  return payload?.message || payload?.msg || payload?.error || fallback;
}

export async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}/api${path}`, {
      credentials: 'include',
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    throw new Error(`无法连接后端 API：${API_BASE}`);
  }
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('json') ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(getErrorMessage(payload, `请求失败（${response.status}）`));
  }
  if (payload && typeof payload === 'object' && payload.success === false) {
    throw new Error(getErrorMessage(payload, '请求失败'));
  }
  return payload?.data ?? payload;
}

export function jsonRequest(path, body, options = {}) {
  return request(path, { ...options, method: options.method || 'POST', body: JSON.stringify(body) });
}

export function clearApiBase() {
  window.localStorage.removeItem('surveyking-api-base');
}