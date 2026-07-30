// fetch wrapper — แนบ JWT จาก localStorage อัตโนมัติ
// dev: เรียกผ่าน /api (vite proxy → backend :4000)
const BASE = '/api';

const getToken = () => localStorage.getItem('token');

const request = async (path, { method = 'GET', body, auth = false, isForm = false } = {}) => {
  const headers = {};
  if (auth) headers.Authorization = `Bearer ${getToken()}`;
  if (body && !isForm) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
  }
  return data;
};

export const api = {
  // public
  getMenu: () => request('/menu'),
  createOrder: (items) => request('/orders', { method: 'POST', body: { items } }),
  login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),

  // admin
  getAllMenu: () => request('/menu/all', { auth: true }),
  createMenu: (formData) => request('/menu', { method: 'POST', body: formData, isForm: true, auth: true }),
  updateMenu: (id, formData) => request(`/menu/${id}`, { method: 'PATCH', body: formData, isForm: true, auth: true }),
  getPendingOrders: () => request('/orders?status=pending', { auth: true }),
  getPendingCount: () => request('/orders/pending-count', { auth: true }),
  completeOrder: (id) => request(`/orders/${id}/complete`, { method: 'PATCH', auth: true }),
  cancelOrder: (id) => request(`/orders/${id}/cancel`, { method: 'PATCH', auth: true }),
  getReport: () => request('/reports/summary', { auth: true }),
  getSales: (period, date) => request(`/reports/sales?period=${period}&date=${date}`, { auth: true }),
};
