import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || 'https://armxdoywlbofufiqjibx.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.warn('Supabase Anon Key is missing. Please add NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env file.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
