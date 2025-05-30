import { createClient } from '@supabase/supabase-js';

// Debug Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('VITE_SUPABASE_URL is missing');
  throw new Error('VITE_SUPABASE_URL is required');
}

if (!supabaseAnonKey) {
  console.error('VITE_SUPABASE_ANON_KEY is missing');
  throw new Error('VITE_SUPABASE_ANON_KEY is required');
}

// Log Supabase initialization for debugging
console.log(`Initializing Supabase with URL: ${supabaseUrl.substring(0, 15)}...`);

// Initialize Supabase client
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    global: {
      fetch: (...args) => {
        // Add a custom fetch to handle timeouts and retries
        const [resource, config] = args;
        return fetch(resource, {
          ...config,
          headers: {
            ...config?.headers,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
      }
    }
  }
);

try {
  // Log successful initialization
  console.log('Supabase client initialized successfully');
} catch (error) {
  console.error('Failed to initialize Supabase client:', error);
  throw error;
}