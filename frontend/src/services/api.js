import { createClient } from '@supabase/supabase-js';

// Retrieve values from Vite env variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project-id.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-supabase-anon-key';

// Initialize Supabase Client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// HTTP API Base URL (routed through proxy in dev, or relative in prod)
const API_BASE = '/api';

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
  const data = await response.json();

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
