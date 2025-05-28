import express from 'express';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import twilio from 'twilio';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist')));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Supabase client with service role key for admin access
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase URL and service role key are required');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// OpenAI configuration
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// Twilio client
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

// QR Code redirect endpoint
app.get('/qr-redirect', async (req, res) => {
  try {
    const { qr: qrId, ad: adSpaceId } = req.query;

    if (!qrId && !adSpaceId) {
      return res.status(400).json({ error: 'QR code ID or Ad Space ID is required' });
    }

    let redirectUrl = null;

    if (qrId) {
      // Get QR code data
      const { data: qrCode, error: qrError } = await supabase
        .from('qr_codes')
        .select('url, ad_space_id')
        .eq('id', qrId)
        .single();

      if (qrError) {
        console.error('Error fetching QR code:', qrError);
        return res.status(404).json({ error: 'QR code not found' });
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

    // Get location data from request
    const location = {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      country: req.headers['cf-ipcountry'] || 'unknown'
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

    if (!redirectUrl) {
      return res.status(404).json({ error: 'No redirect URL found' });
    }

    // Redirect to the destination URL
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('QR redirect error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rest of your existing routes...

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});