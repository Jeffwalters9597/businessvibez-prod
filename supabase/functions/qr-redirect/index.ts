import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const qrId = url.searchParams.get('qr');
    const adSpaceId = url.searchParams.get('ad');

    if (!qrId && !adSpaceId) {
      return new Response(
        JSON.stringify({ error: 'QR code ID or Ad Space ID is required' }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Initialize Supabase admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        }
      }
    );

    let redirectUrl = null;

    if (qrId) {
      // Get QR code data
      const { data: qrCode, error: qrError } = await supabaseAdmin
        .from('qr_codes')
        .select('url, ad_space_id')
        .eq('id', qrId)
        .single();

      if (qrError || !qrCode) {
        return new Response(
          JSON.stringify({ error: 'QR code not found' }), 
          { 
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          }
        );
      }

      redirectUrl = qrCode.url;
      
      // Use the QR code's ad space if none was provided
      if (!adSpaceId && qrCode.ad_space_id) {
        adSpaceId = qrCode.ad_space_id;
      }

      // Record the scan
      try {
        await supabaseAdmin.rpc('increment_qr_code_scans', {
          qr_id: qrId,
          ad_id: adSpaceId,
          ip: req.headers.get('x-forwarded-for') || 'unknown',
          agent: req.headers.get('user-agent') || 'unknown',
          loc: {
            country: req.headers.get('cf-ipcountry') || 'unknown'
          }
        });
      } catch (error) {
        console.error('Error recording scan:', error);
      }
    }

    if (adSpaceId) {
      // Get ad space data
      const { data: adSpace, error: adError } = await supabaseAdmin
        .from('ad_spaces')
        .select('content')
        .eq('id', adSpaceId)
        .single();

      if (!adError && adSpace?.content?.url) {
        redirectUrl = adSpace.content.url;
      }

      // Increment ad space views
      try {
        await supabaseAdmin.rpc('increment_ad_space_views', {
          space_id: adSpaceId
        });
      } catch (error) {
        console.error('Error incrementing views:', error);
      }
    }

    if (!redirectUrl) {
      return new Response(
        JSON.stringify({ error: 'No redirect URL found' }), 
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Redirect to the destination URL
    return new Response(null, {
      status: 302,
      headers: {
        'Location': redirectUrl,
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('QR redirect error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
});