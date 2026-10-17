import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || 'https://armxdoywlbofufiqjibx.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFybXhkb3l3bGJvZnVmaXFqaWJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjkwMjEsImV4cCI6MjA5MTQwNTAyMX0.B3_pE67EX17Wf1LNxW9kT6XGeacZQpz3oRDOd7DHwN8';

// Polyfill WebSocket in Node runtime if missing to prevent RealtimeClient initialization errors
if (typeof window === 'undefined' && typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class DummyWebSocket {};
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;

