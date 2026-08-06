import { createClient } from '@supabase/supabase-js';

const defaultUrl = 'https://jxbhkihygutgcamoketk.supabase.co';
const defaultKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4YmhraWh5Z3V0Z2NhbW9rZXRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMzMyMDQsImV4cCI6MjA4OTkwOTIwNH0.1T50EU8oF2gbEl6skWQ7XNgUeOOo6v8myBcnuKyDbJc';

function getUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (typeof envUrl === 'string' && envUrl.trim().startsWith('http')) {
    return envUrl.trim();
  }
  return defaultUrl;
}

function getKey(): string {
  const envKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (typeof envKey === 'string' && envKey.trim().length > 10) {
    return envKey.trim();
  }
  return defaultKey;
}

export const supabase = createClient(getUrl(), getKey());


