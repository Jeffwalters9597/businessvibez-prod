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

interface AdDesign {
  id: string;
  image_url?: string;
  content: {
    redirectUrl?: string;
  };
}

const View = () => {
  const [searchParams] = useSearchParams();
  const [adData, setAdData] = useState<AdSpace | null>(null);
  const [adDesign, setAdDesign] = useState<AdDesign | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState(3);
  const [redirectClicked, setRedirectClicked] = useState(false);

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
            .maybeSingle();

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
            .maybeSingle();

          if (adError) {
            console.error('Ad space error:', adError);
            if (adError.code === 'PGRST116') {
              throw new Error('Ad space not found');
            }
            throw adError;
          }

          if (adSpaceData) {
            setAdData(adSpaceData);
            
            // Check if there's a redirect URL in the ad space content
            if (adSpaceData.content?.url) {
              finalRedirectUrl = adSpaceData.content.url;
            }

            // Get associated ad design for potential image
            try {
              const { data: adDesignData, error: designError } = await supabase
                .from('ad_designs')
                .select('*')
                .eq('ad_space_id', adSpaceId)
                .maybeSingle();
  
              if (!designError && adDesignData) {
                setAdDesign(adDesignData);
                
                // If this is a redirect ad design, use its redirect URL
                if (adDesignData.content?.redirectUrl) {
                  finalRedirectUrl = adDesignData.content.redirectUrl;
                }
              }
            } catch (designQueryError) {
              console.error('Error fetching ad design:', designQueryError);
              // Don't throw error here, just continue without ad design data
            }
          }

          // Record ad space view
          try {
            await supabase.rpc('increment_ad_space_views', {
              space_id: adSpaceId
            });
          } catch (viewError) {
            console.error('Error recording view:', viewError);
            // Continue even if view recording fails
          }
        }

        // Record QR code scan
        if (qrId) {
          try {
            await supabase.rpc('increment_qr_code_scans', {
              qr_id: qrId,
              ad_id: adSpaceId,
              ip: 'anonymous',
              agent: navigator.userAgent,
              loc: {}
            });
          } catch (scanError) {
            console.error('Error recording QR scan:', scanError);
            // Continue even if scan recording fails
          }
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

  // Handle redirect countdown
  useEffect(() => {
    if (redirectUrl && !redirectClicked && redirectCountdown > 0) {
      const timer = setTimeout(() => {
        setRedirectCountdown(redirectCountdown - 1);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [redirectUrl, redirectCountdown, redirectClicked]);

  // Manual redirect handler
  const handleRedirect = () => {
    if (!redirectUrl) return;
    
    try {
      // Use a simple anchor element to handle the navigation
      // This avoids issues with service workers or iframe restrictions
      const link = document.createElement('a');
      link.href = redirectUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setRedirectClicked(true);
    } catch (err) {
      console.error('Navigation error:', err);
      // If automatic navigation fails, show an error and encourage manual clicking
      setError('Unable to navigate automatically. Please click the link below to continue.');
    }
  };

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
            {redirectUrl && (
              <div className="mt-4">
                <p className="mb-2">You can try visiting the link directly:</p>
                <a 
                  href={redirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-500 hover:text-primary-700 underline break-all"
                >
                  {redirectUrl}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Custom ad with image display
  if (adDesign?.image_url && !redirectUrl) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-0 m-0 overflow-hidden"
        style={{ 
          backgroundColor: adData?.theme?.backgroundColor || '#f9fafb'
        }}
      >
        <img 
          src={adDesign.image_url}
          alt={adData?.title || "Advertisement"}
          className="max-w-full max-h-screen object-contain"
        />
      </div>
    );
  }

  // Redirect ad or ad space content display
  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ 
        backgroundColor: adData?.theme?.backgroundColor || '#f9fafb',
        color: adData?.theme?.textColor || '#111827'
      }}
    >
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-2xl md:text-3xl font-bold mb-4">{adData?.title || "Advertisement"}</h1>
        {adData?.description && (
          <p className="text-base md:text-lg mb-6 md:mb-8">{adData.description}</p>
        )}
        {redirectUrl && (
          <div>
            <div className="text-lg md:text-xl p-4 bg-white bg-opacity-20 rounded-lg mb-4">
              <a 
                href={redirectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all hover:underline"
                onClick={() => setRedirectClicked(true)}
              >
                {redirectUrl}
              </a>
            </div>
            
            {!redirectClicked ? (
              <button
                onClick={handleRedirect}
                className="mt-2 px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                {redirectCountdown > 0 
                  ? `Continue to destination (${redirectCountdown})`
                  : 'Continue to destination'}
              </button>
            ) : (
              <p className="mt-4 text-sm text-gray-600">
                If you're not automatically redirected, please click the link above.
              </p>
            )}
          </div>
        )}
        {!redirectUrl && !adDesign?.image_url && (
          <p className="text-lg font-medium p-4 bg-error-100 text-error-700 rounded-lg">
            This ad doesn't have any content to display
          </p>
        )}
      </div>
    </div>
  );
};

export default View;