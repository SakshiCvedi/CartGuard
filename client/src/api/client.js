const BASE = '/api';

function getToken() {
  return localStorage.getItem('cartguard_token');
}

export function setToken(token) {
  if (token) localStorage.setItem('cartguard_token', token);
  else localStorage.removeItem('cartguard_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    setToken(null);
    window.location.hash = '#/login';
    throw new Error('Session expired — please log in again.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  demoEmail: () => request('/auth/me'),

  overview: () => request('/metrics/overview'),

  carts: (status) => request(`/carts${status ? `?status=${status}` : ''}`),
  cart: (id) => request(`/carts/${id}`),
  recoverCart: (id) => request(`/carts/${id}/recover`, { method: 'POST' }),
  toggleEmail: (cartId, emailId, field) => request(`/carts/${cartId}/emails/${emailId}/toggle`, { method: 'POST', body: JSON.stringify({ field }) }),
  simulateAbandoned: () => request('/carts/simulate/abandoned', { method: 'POST' }),
  simulatePurchase: () => request('/carts/simulate/purchase', { method: 'POST' }),

  products: () => request('/products'),
  simulateLowStock: () => request('/products/simulate/low-stock', { method: 'POST' }),

  alerts: (resolved) => request(`/alerts${resolved !== undefined ? `?resolved=${resolved}` : ''}`),
  resolveAlert: (id) => request(`/alerts/${id}/resolve`, { method: 'POST' }),

  templates: () => request('/templates'),
  updateTemplate: (id, payload) => request(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
};
