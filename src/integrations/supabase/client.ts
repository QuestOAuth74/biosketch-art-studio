import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { createLoggedSupabaseClient } from './logger';

// Baked-in for the desktop build. The anon/publishable key is designed to
// be public (RLS protects data); embedding it keeps the desktop installer
// self-contained and lets CI/CD build without secrets.
const SUPABASE_URL = 'https://tljsbmpglwmzyaoxsqyj.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsanNibXBnbHdtenlhb3hzcXlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NTUyMDgsImV4cCI6MjA3NjMzMTIwOH0.N62jwp7KE09a2WrftnH2bGB4gbajY0bTLt4_pQnefS0';

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

// Create the base Supabase client
const baseClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-client-info': 'science-canvas-creator@1.0.0'
    }
  }
});

// Wrap with logging in development mode
export const supabase = createLoggedSupabaseClient(baseClient);

// Connection monitoring disabled to reduce console noise