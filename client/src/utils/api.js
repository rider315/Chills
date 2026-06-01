const BASE_URL = import.meta.env.VITE_API_URL || '';

const getHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

async function handleResponse(res) {
  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Unauthorized - please log in');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.error || data?.message || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const getAuthHeaderOnly = () => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export async function get(url) {
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'GET',
    headers: getHeaders(),
  });
  return handleResponse(res);
}

export async function post(url, body) {
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

export async function put(url, body) {
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

export async function del(url) {
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  return handleResponse(res);
}

export async function upload(url, formData) {
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'POST',
    headers: getAuthHeaderOnly(),
    body: formData,
  });
  return handleResponse(res);
}

export default { get, post, put, del, upload };
