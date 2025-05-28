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
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [debug, setDebug] = useState<string[]>([]);

  const addDebug = (message: string) => {
    console.log(message);
    setDebug(prev => [...prev, message]);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        addDebug("Starting data fetch");
        const qrId = searchParams.get('qr');
        const adId = searchParams.get('ad');

        if (!qrId && !adId) {
          throw new Error('Missing QR code or ad space ID');
        }

        addDebug(`Found params: qrId=${qrId}, adId=${adId}`);
        
        let finalRedirectUrl: string | null = null;
        let adSpaceId = adId;

        // If QR code ID is provided, get the URL and associated ad space
        if (qrId) {
          addDebug("Fetching QR code data");
          try {
            const { data: qrCode, error: qrError } = await supabase
              .from('qr_codes')
              .select('url, ad_space_id')
              .eq('id', qrId)
              .maybeSingle();

            if (qrError) {
              addDebug(`QR code error: ${qrError.message}`);
              if (qrError.code === 'PGRST116') {
                throw new Error('QR code not found');
              }
              throw qrError;
            }

            if (qrCode) {
              addDebug(`QR code found: ${JSON.stringify(qrCode)}`);
              finalRedirectUrl = qrCode.url;
              // Use QR code's ad space if none provided
              if (!adSpaceId && qrCode.ad_space_id) {
                adSpaceId = qrCode.ad_space_id;
                addDebug(`Using QR code's ad space: ${adSpaceId}`);
              }
            }
          } catch (qrFetchError) {
            addDebug(`Error fetching QR: ${qrFetchError}`);
          }
        }

        // Get ad space data if we have an ID
        if (adSpaceId) {
          addDebug(`Fetching ad space: ${adSpaceId}`);
          try {
            const { data: adSpaceData, error: adError } = await supabase
              .from('ad_spaces')
              .select('*')
              .eq('id', adSpaceId)
              .maybeSingle();

            if (adError) {
              addDebug(`Ad space error: ${adError.message}`);
              if (adError.code === 'PGRST116') {
                throw new Error('Ad space not found');
              }
              throw adError;
            }

            if (adSpaceData) {
              addDebug(`Ad space found: ${adSpaceData.title}`);
              setAdData(adSpaceData);
              
              // Check if there's a redirect URL in the ad space content
              if (adSpaceData.content?.url) {
                finalRedirectUrl = adSpaceData.content.url;
                addDebug(`Found redirect URL in ad space: ${finalRedirectUrl}`);
              }

              // Get associated ad design for potential image
              try {
                addDebug(`Fetching ad design for space: ${adSpaceId}`);
                const { data: adDesignData, error: designError } = await supabase
                  .from('ad_designs')
                  .select('*')
                  .eq('ad_space_id', adSpaceId)
                  .maybeSingle();
    
                if (designError) {
                  addDebug(`Design fetch error: ${designError.message}`);
                } else if (adDesignData) {
                  addDebug(`Ad design found with image: ${adDesignData.image_url ? 'yes' : 'no'}`);
                  setAdDesign(adDesignData);
                  
                  // If this is a redirect ad design, use its redirect URL
                  if (adDesignData.content?.redirectUrl) {
                    finalRedirectUrl = adDesignData.content.redirectUrl;
                    addDebug(`Using redirect URL from ad design: ${finalRedirectUrl}`);
                  }
                } else {
                  addDebug("No ad design found for this ad space");
                }
              } catch (designQueryError: any) {
                addDebug(`Error fetching design: ${designQueryError.message}`);
              }
            }

            // Record ad space view
            try {
              addDebug("Recording ad space view");
              await supabase.rpc('increment_ad_space_views', {
                space_id: adSpaceId
              });
              addDebug("View recorded successfully");
            } catch (viewError: any) {
              addDebug(`Error recording view: ${viewError.message}`);
            }
          } catch (adSpaceError: any) {
            addDebug(`Ad space fetch error: ${adSpaceError.message}`);
          }
        }

        // Record QR code scan
        if (qrId) {
          try {
            addDebug("Recording QR scan");
            await supabase.rpc('increment_qr_code_scans', {
              qr_id: qrId,
              ad_id: adSpaceId,
              ip: 'anonymous',
              agent: navigator.userAgent,
              loc: {}
            });
            addDebug("QR scan recorded");
          } catch (scanError: any) {
            addDebug(`Error recording scan: ${scanError.message}`);
          }
        }

        // Set redirect URL if we have one
        if (finalRedirectUrl) {
          setRedirectUrl(finalRedirectUrl);
          addDebug(`Final redirect URL set: ${finalRedirectUrl}`);
        } else {
          addDebug("No redirect URL found");
        }
      } catch (err: any) {
        console.error('Error in View component:', err);
        addDebug(`General error: ${err.message}`);
        setError(err.message || 'An unexpected error occurred');
      } finally {
        setIsLoading(false);
        addDebug("Data fetch completed");
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

  // Pre-load image to check if it's available
  useEffect(() => {
    if (adDesign?.image_url) {
      addDebug(`Preloading image: ${adDesign.image_url}`);
      const img = new Image();
      img.onload = () => {
        addDebug("Image loaded successfully");
        setImageLoaded(true);
      };
      img.onerror = () => {
        addDebug(`Failed to load image: ${adDesign.image_url}`);
        setImageError(true);
      };
      img.src = adDesign.image_url;
    } else {
      addDebug("No image URL to preload");
    }
  }, [adDesign?.image_url]);

  // Manual redirect handler
  const handleRedirect = () => {
    if (!redirectUrl) return;
    
    try {
      addDebug(`Redirecting to: ${redirectUrl}`);
      // For mobile compatibility, try simple location change first
      window.location.href = redirectUrl;
      setRedirectClicked(true);
    } catch (err: any) {
      addDebug(`Navigation error: ${err.message}`);
      // If automatic navigation fails, show an error and encourage manual clicking
      setError('Unable to navigate automatically. Please click the link below to continue.');
    }
  };

  // Show debug info in development
  const showDebugInfo = import.meta.env.DEV && debug.length > 0;

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
          
          {showDebugInfo && (
            <div className="mt-4 p-4 bg-gray-100 rounded-lg text-left">
              <p className="font-semibold mb-2">Debug Info:</p>
              <ul className="text-xs space-y-1 max-h-48 overflow-y-auto">
                {debug.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Custom ad with image display
  if (adDesign?.image_url && !redirectUrl) {
    return (
      <div 
        className="min-h-screen flex flex-col items-center justify-center p-0 m-0 overflow-hidden"
        style={{ 
          backgroundColor: adData?.theme?.backgroundColor || '#f9fafb'
        }}
      >
        {!imageLoaded && !imageError && (
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        )}
        
        <div className="w-full h-full flex items-center justify-center">
          {imageError ? (
            // Fallback image when the main one fails to load
            <img 
              src="/missing-image.svg"
              alt={adData?.title || "Advertisement"}
              className="w-full h-auto max-h-screen object-contain"
            />
          ) : (
            <img 
              src={adDesign.image_url}
              alt={adData?.title || "Advertisement"}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              className={`w-full h-auto max-h-screen object-contain ${!imageLoaded ? 'hidden' : 'block'}`}
            />
          )}
        </div>

        {adData?.title && (imageLoaded || imageError) && (
          <div className="fixed bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-4 text-center">
            <h1 className="text-xl font-bold">{adData.title}</h1>
            {adData.description && <p className="text-sm mt-1">{adData.description}</p>}
          </div>
        )}
        
        {showDebugInfo && (
          <div className="fixed top-2 right-2 p-2 bg-black bg-opacity-70 text-white text-xs rounded max-w-xs max-h-40 overflow-auto">
            <p className="font-bold">Debug:</p>
            <ul>
              {debug.slice(-5).map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        )}
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
            <div className="text-lg md:text-xl p-4 bg-white bg-opacity-20 rounded-lg mb-4 break-words">
              <a 
                href={redirectUrl}
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
        {(!redirectUrl && (!adDesign?.image_url || imageError)) && (
          <div>
            <p className="text-lg font-medium p-4 bg-error-100 text-error-700 rounded-lg">
              This ad doesn't have any content to display
            </p>
            {imageError && adDesign?.image_url && (
              <p className="mt-4 text-sm text-gray-600">
                There was an error loading the image for this ad.
              </p>
            )}
          </div>
        )}
        
        {showDebugInfo && (
          <div className="mt-4 p-4 bg-gray-100 rounded-lg text-left">
            <p className="font-semibold mb-2">Debug Info:</p>
            <ul className="text-xs space-y-1 max-h-48 overflow-y-auto">
              {debug.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default View;