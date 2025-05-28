const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const handler = async (req, res) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    return res.end();
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const qrId = url.searchParams.get('qr');
    const adSpaceId = url.searchParams.get('ad');

    if (!qrId && !adSpaceId) {
      res.writeHead(400, { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      });
      return res.end(JSON.stringify({ 
        error: 'QR code ID or Ad Space ID is required' 
      }));
    }

    // Initialize Supabase client with environment variables
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    let redirectUrl = '/';

    if (qrId) {
      // Get QR code data
      const { data: qrCode, error: qrError } = await supabase
        .from('qr_codes')
        .select('url, ad_space_id')
        .eq('id', qrId)
        .single();

      if (qrError) {
        console.error('Error fetching QR code:', qrError);
        res.writeHead(404, { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        });
        return res.end(JSON.stringify({ error: 'QR code not found' }));
      }

      if (qrCode) {
        redirectUrl = qrCode.url;
        // Use the QR code's ad space if none was provided
        if (!adSpaceId && qrCode.ad_space_id) {
          adSpaceId = qrCode.ad_space_id;
        }
      }
    }

    if (adSpaceId) {
      // Get ad space data
      const { data: adSpace, error: adError } = await supabase
        .from('ad_spaces')
        .select('content')
        .eq('id', adSpaceId)
        .single();

      if (adError) {
        console.error('Error fetching ad space:', adError);
      } else if (adSpace?.content?.url) {
        redirectUrl = adSpace.content.url;
      }
    }

    // Get location data from request headers
    const location = {
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown',
      country: req.headers['cf-ipcountry'] || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown'
    };

    // Record the scan if it's a QR code
    if (qrId) {
      try {
        await supabase.rpc('increment_qr_code_scans', {
          qr_id: qrId,
          ad_id: adSpaceId,
          ip: location.ip,
          agent: location.userAgent,
          loc: location
        });
      } catch (error) {
        console.error('Error recording QR scan:', error);
      }
    }

    // Increment ad space views
    if (adSpaceId) {
      try {
        await supabase.rpc('increment_ad_space_views', {
          space_id: adSpaceId
        });
      } catch (error) {
        console.error('Error incrementing ad views:', error);
      }
    }

    // Redirect to destination URL
    res.writeHead(302, { 
      'Location': redirectUrl,
      ...corsHeaders
    });
    res.end();

  } catch (error) {
    console.error('QR redirect error:', error);
    res.writeHead(500, { 
      'Content-Type': 'application/json',
      ...corsHeaders 
    });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
};

module.exports = handler;