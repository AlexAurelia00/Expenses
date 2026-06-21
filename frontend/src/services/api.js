import { createClient } from '@supabase/supabase-js';

// Retrieve values from Vite env variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project-id.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-supabase-anon-key';

// Initialize Supabase Client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// HTTP API Base URL (routed through proxy in dev).
// For production set `VITE_API_BASE` to your backend URL (e.g. https://api.example.com/api)
// If it's missing or left as the default '/api' in a static build, fall back to the known backend host.
const rawApiBase = import.meta.env.VITE_API_BASE || '/api';
const FALLBACK_BACKEND = 'https://expenses-pj86.onrender.com/api';
const API_BASE = (rawApiBase === '/api' || !rawApiBase) ? FALLBACK_BACKEND : rawApiBase;

// Log the resolved API base to help troubleshoot live deployments
console.info('Resolved API_BASE =', API_BASE);

// Helper to get authorization headers
const getHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

// Generic HTTP request handler
const request = async (endpoint, options = {}) => {
  const url = `${API_BASE}${endpoint}`;
  const headers = await getHeaders();
  
  const config = {
    ...options,
    headers: {
      ...headers,
      ...options.headers
    }
  };

  const response = await fetch(url, config);

  // If the response is JSON parse it, otherwise return the raw text for better error visibility
  const contentType = response.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    // Throw a descriptive error so the caller sees HTML error pages when the API endpoint is wrong
    if (!response.ok) {
      throw new Error(`Non-JSON response (${response.status}): ${text.substring(0, 500)}`);
    }
    // If response.ok but non-JSON, return the raw text
    return text;
  }

  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong with the request.');
  }

  return data;
};

// API Client object
export const api = {
  get: (endpoint) => request(endpoint, { method: 'GET' }),
  post: (endpoint, body) => request(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => request(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (endpoint, body) => request(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (endpoint) => request(endpoint, { method: 'DELETE' }),

  // Special download handler for PDF, Excel, and CSV files
  download: async (endpoint, filename) => {
    const url = `${API_BASE}${endpoint}`;
    const headers = await getHeaders();
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': headers.Authorization // forward bearer token
      }
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Failed to download report.');
    }

    const blob = await response.blob();
    const localUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = localUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(localUrl);
  }
};
