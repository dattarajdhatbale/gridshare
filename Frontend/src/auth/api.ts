import { API_BASE_URL } from '../config';

/**
 * Custom fetch wrapper that injects the Bearer Token from localStorage.
 * Automatically handles 401 Unauthorized by clearing the token and reloading the page.
 */
export async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('gridshare-token');
  
  const headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('gridshare-token');
    // Force a reload to cleanly wipe React state and show the login screen
    window.location.reload();
  }

  return response;
}
