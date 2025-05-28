import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface AdSpace {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  content: Record<string, unknown>;
  theme: Record<string, unknown>;
  views: number;
  created_at: string;
  updated_at: string;
  ad_designs?: Array<Record<string, unknown>>;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const id = url.searchParams.get('id');

      if (!id) {
        return new Response(
          JSON.stringify({ error: 'Ad space ID is required' }), 
          { 
            status: 400,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            }
          }
        );
      }

      const { data: adSpace, error } = await supabase
        .from('ad_spaces')
        .select(`
          *,
          ad_designs (*)
        `)
        .eq('id', id)
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Ad space not found' }), 
          { 
            status: 404,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            }
          }
        );
      }

      // Increment view count
      await supabase.rpc('increment_ad_space_views', {
        space_id: id
      });

      return new Response(
        JSON.stringify(adSpace),
        { 
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }), 
      { 
        status: 405,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }
      }
    );
  } catch (error) {
    console.error('Ad space error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }
      }
    );
  }
});