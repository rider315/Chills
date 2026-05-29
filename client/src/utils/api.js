const BASE_URL = import.meta.env.VITE_API_URL || '';

async function handleResponse(res) {
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

export async function get(url) {
  const res = await fetch(`${BASE_URL}${url}`);
  return handleResponse(res);
}

export async function post(url, body) {
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

export async function put(url, body) {
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

export async function del(url) {
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'DELETE',
  });
  return handleResponse(res);
}

export async function upload(url, formData) {
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse(res);
}

export default { get, post, put, del, upload };
