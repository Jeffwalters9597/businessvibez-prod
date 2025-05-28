const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const handler = async (req, res) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    return res.end();
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    if (req.method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const id = url.searchParams.get('id');

      if (!id) {
        res.writeHead(400, { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        });
        return res.end(JSON.stringify({ error: 'Ad space ID is required' }));
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
        res.writeHead(404, { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        });
        return res.end(JSON.stringify({ error: 'Ad space not found' }));
      }

      // Increment view count
      await supabase.rpc('increment_ad_space_views', {
        space_id: id
      });

      res.writeHead(200, { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      });
      res.end(JSON.stringify(adSpace));
    } else {
      res.writeHead(405, { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
    }
  } catch (error) {
    console.error('Ad space error:', error);
    res.writeHead(500, { 
      'Content-Type': 'application/json',
      ...corsHeaders 
    });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
};

module.exports = handler;