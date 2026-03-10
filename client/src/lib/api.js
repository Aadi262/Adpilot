import axios from 'axios';
import useAuthStore from '../store/authStore';

const api = axios.create({
  // In production VITE_API_URL is set to the Railway backend URL.
  // In dev the Vite proxy rewrites /api → localhost:3000, so we use a relative path.
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api/v1`
    : '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: 30000,
});

// Attach token from store on every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, logout and redirect to login.
// Also normalizes paginated list responses so callers always get r.data.data as the
// items array — instead of r.data.data.items — for endpoints that use the paginated()
// helper.  Non-paginated responses (single objects, named-key arrays) are untouched.
api.interceptors.response.use(
  (response) => {
    const body = response.data;
    // paginated() helper produces: { data: { items: [...] }, meta: { pagination: {...} } }
    // Promote items[] to the data level and expose pagination at response.data.pagination.
    if (body?.data !== null && typeof body?.data === 'object' && 'items' in body.data) {
      response.data = {
        ...body,
        data:       body.data.items,
        pagination: body.meta?.pagination ?? null,
      };
    }
    return response;
  },
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    // 500-level server errors — fire a custom event so any toast listener can react
    if (status >= 500) {
      window.dispatchEvent(new CustomEvent('api:server-error', {
        detail: { message: error.response?.data?.error?.message || 'Server error. Please try again.' },
      }));
    }
    return Promise.reject(error);
  }
);

export default api;
