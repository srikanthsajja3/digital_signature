import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase project URL and Anon Key
const supabaseUrl = 'https://sotideecrzlduhwmhhfn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvdGlkZWVjcnpsZHVod21oaGZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1Nzc4MTQsImV4cCI6MjA5NDE1MzgxNH0.dXDhh0qLOZKFpeuipoC85Ngpxw_8tTZzwI14ARb_ey8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
