import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// On Node.js < 22 the global WebSocket is not available. Supply a
// compatible implementation via the `ws` package so Supabase realtime works.
import ws from 'ws';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project-id.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'your-supabase-anon-key';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-supabase-service-role-key';

// Client for standard queries (inheriting role)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { transport: ws }
});

// Client for service-role overrides (administrative queries, RLS bypass)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  realtime: { transport: ws }
});
