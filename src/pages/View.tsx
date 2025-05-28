import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface AdSpace {
  id: string;
  title: string;
  description: string;
  content: {
    url?: string;
    headline?: string;
    subheadline?: string;
  };
  theme: {
    backgroundColor?: string;
    textColor?: string;
  };
}

const View = () => {
  const [searchParams] = useSearchParams();
  const [adData, setAdData] = useState<AdSpace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const qrId = searchParams.get('qr');
        const adId = searchParams.get('ad');

        if (!qrId && !adId) {
          throw new Error('Missing QR code or ad space ID');
        }

        let finalRedirectUrl: string | null = null;
        let adSpaceId = adId;

        // If QR code ID is provided, get the URL and associated ad space
        if (qrId) {
          const { data: qrCode, error: qrError } = await supabase
            .from('qr_codes')
            .select('url, ad_space_id')
            .eq('id', qrId)
            .single();

          if (qrError) {
            console.error('QR code error:', qrError);
            if (qrError.code === 'PGRST116') {
              throw new Error('QR code not found');
            }
            throw qrError;
          }

          if (qrCode) {
            finalRedirectUrl = qrCode.url;
            // Use QR code's ad space if none provided
            if (!adSpaceId && qrCode.ad_space_id) {
              adSpaceId = qrCode.ad_space_id;
            }
          }
        }

        // Get ad space data if we have an ID
        if (adSpaceId) {
          const { data: adSpaceData, error: adError } = await supabase
            .from('ad_spaces')
            .select('*')
            .eq('id', adSpaceId)
            .single();

          if (adError) {
            console.error('Ad space error:', adError);
            if (adError.code === 'PGRST116') {
              throw new Error('Ad space not found');
            }
            throw adError;
          }

          if (adSpaceData) {
            setAdData(adSpaceData);
            if (adSpaceData.content?.url) {
              finalRedirectUrl = adSpaceData.content.url;
            }
          }

          // Record ad space view
          await supabase.rpc('increment_ad_space_views', {
            space_id: adSpaceId
          });
        }

        // Record QR code scan
        if (qrId) {
          await supabase.rpc('increment_qr_code_scans', {
            qr_id: qrId,
            ad_id: adSpaceId,
            ip: 'anonymous',
            agent: navigator.userAgent,
            loc: {}
          });
        }

        // Set redirect URL if we have one
        if (finalRedirectUrl) {
          setRedirectUrl(finalRedirectUrl);
        }
      } catch (err: any) {
        console.error('Error in View component:', err);
        setError(err.message || 'An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [searchParams]);

  // Handle redirect after data is loaded
  useEffect(() => {
    if (redirectUrl) {
      const timer = setTimeout(() => {
        window.location.href = redirectUrl;
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [redirectUrl]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center w-full max-w-md mx-auto">
          <div className="bg-error-100 text-error-700 p-6 rounded-lg">
            <p className="text-lg font-semibold mb-2">Error</p>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!adData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center w-full max-w-md mx-auto">
          <div className="bg-warning-100 text-warning-700 p-6 rounded-lg">
            <p className="text-lg font-semibold mb-2">No Ad Space Found</p>
            <p>The requested ad space could not be found.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ 
        backgroundColor: adData.theme?.backgroundColor || '#f9fafb',
        color: adData.theme?.textColor || '#111827'
      }}
    >
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-2xl md:text-3xl font-bold mb-4">{adData.title}</h1>
        {adData.description && (
          <p className="text-base md:text-lg mb-6 md:mb-8">{adData.description}</p>
        )}
        {adData.content?.headline && (
          <h2 className="text-xl md:text-2xl font-semibold mb-3 md:mb-4">
            {adData.content.headline}
          </h2>
        )}
        {adData.content?.subheadline && (
          <p className="text-lg md:text-xl">{adData.content.subheadline}</p>
        )}
        {redirectUrl && (
          <p className="mt-6 md:mt-8 text-sm opacity-75">Redirecting you shortly...</p>
        )}
      </div>
    </div>
  );
};

export default View;