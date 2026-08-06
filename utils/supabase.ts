import { createClient } from '@supabase/supabase-js';

const defaultUrl = 'https://jxbhkihygutgcamoketk.supabase.co';
const defaultKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4YmhraWh5Z3V0Z2NhbW9rZXRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMzMyMDQsImV4cCI6MjA4OTkwOTIwNH0.1T50EU8oF2gbEl6skWQ7XNgUeOOo6v8myBcnuKyDbJc';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || defaultUrl;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || defaultKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

