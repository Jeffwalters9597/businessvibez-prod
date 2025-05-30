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
        
        // Create a new config object that properly preserves all headers
        const newConfig = { ...config };
        
        // Create a Headers object to properly handle header merging
        const headers = new Headers(config?.headers || {});
        headers.set('Cache-Control', 'no-cache');
        headers.set('Pragma', 'no-cache');
        
        // Use the headers object in the new config
        newConfig.headers = headers;
        
        return fetch(resource, newConfig);
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