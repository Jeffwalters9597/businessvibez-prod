import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import DebugPanel from '../components/ui/DebugPanel';
import { getAdDesignByAdSpaceId, debugAdSpaceDetails, debugAdDesignsSchema } from '../AdDesignMapper';
import { isMobileDevice, preloadImage, safeRedirect, getDeviceInfo } from '../mobile-fixes';

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
  video_url?: string;
  content: {
    redirectUrl?: string;
  };
}

// Function to validate UUID format
const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Function to check if a URL is a blob URL
const isBlobUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  return url.startsWith('blob:');
};

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
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [debug, setDebug] = useState<string[]>([]);
  const [deviceInfo, setDeviceInfo] = useState<string>('');
  const [isMobile, setIsMobile] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const addDebug = (message: string) => {
    console.log(message);
    setDebug(prev => [...prev, message]);
  };

  useEffect(() => {
    // Collect device info for debugging
    const deviceData = getDeviceInfo();
    setIsMobile(deviceData.isMobile);
    
    const deviceInfoStr = `Device: ${deviceData.isMobile ? 'Mobile' : 'Desktop'}, OS: ${deviceData.os}, Browser: ${deviceData.browser}, Viewport: ${deviceData.viewportWidth}x${deviceData.viewportHeight}, PixelRatio: ${deviceData.pixelRatio}`;
    setDeviceInfo(deviceInfoStr);
    addDebug(deviceInfoStr);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        addDebug("Starting data fetch");
        const qrId = searchParams.get('qr');
        let adId = searchParams.get('ad');

        if (!qrId && !adId) {
          throw new Error('Missing QR code or ad space ID');
        }

        // Validate UUID format for adId
        if (adId && !isValidUUID(adId)) {
          addDebug(`Invalid UUID format for adId: ${adId}`);
          throw new Error('Invalid ad ID format');
        }

        // Validate UUID format for qrId
        if (qrId && !isValidUUID(qrId)) {
          addDebug(`Invalid UUID format for qrId: ${qrId}`);
          throw new Error('Invalid QR code ID format');
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

              // Mobile-specific optimizations for ad design fetching
              if (isMobile) {
                addDebug("Using mobile-optimized fetching strategy");
                
                // More aggressive approach for mobile: try all strategies in sequence
                // and retry multiple times if needed
                try {
                  // First attempt: direct query for ad_designs with this ad_space_id
                  const { data: mobileAdDesign, error: mobileError } = await supabase
                    .from('ad_designs')
                    .select('*')
                    .eq('ad_space_id', adSpaceId)
                    .maybeSingle();
                  
                  if (mobileError) {
                    addDebug(`Mobile query error: ${mobileError.message}`);
                  } else if (mobileAdDesign) {
                    addDebug(`Mobile direct query successful: ${mobileAdDesign.id}`);
                    
                    // Check for blob URLs and don't use them
                    if (isBlobUrl(mobileAdDesign.image_url)) {
                      addDebug('Found blob URL for image, ignoring it');
                      mobileAdDesign.image_url = null;
                    }
                    
                    if (isBlobUrl(mobileAdDesign.video_url)) {
                      addDebug('Found blob URL for video, ignoring it');
                      mobileAdDesign.video_url = null;
                    }
                    
                    setAdDesign(mobileAdDesign);
                    
                    // Pre-fetch image for mobile
                    if (mobileAdDesign.image_url) {
                      const preloadSuccess = await preloadImage(mobileAdDesign.image_url);
                      addDebug(`Mobile image preload ${preloadSuccess ? 'successful' : 'failed'}: ${mobileAdDesign.image_url}`);
                      
                      if (!preloadSuccess) {
                        setImageError(true);
                      }
                    }
                  } else {
                    // Fallback to standard fetching method with debugging
                    addDebug("Mobile direct query failed, falling back to standard method");
                    
                    // Try to get ad design using the mapper function
                    const adDesignData = await getAdDesignByAdSpaceId(adSpaceId);
                    
                    if (adDesignData) {
                      addDebug(`Standard method found design: ${adDesignData.id}`);
                      
                      // Check for blob URLs and don't use them
                      if (isBlobUrl(adDesignData.image_url)) {
                        addDebug('Found blob URL for image, ignoring it');
                        adDesignData.image_url = null;
                      }
                      
                      if (isBlobUrl(adDesignData.video_url)) {
                        addDebug('Found blob URL for video, ignoring it');
                        adDesignData.video_url = null;
                      }
                      
                      setAdDesign(adDesignData);
                      
                      if (adDesignData.image_url) {
                        const preloadSuccess = await preloadImage(adDesignData.image_url);
                        addDebug(`Image preload ${preloadSuccess ? 'successful' : 'failed'}: ${adDesignData.image_url}`);
                        
                        if (!preloadSuccess) {
                          setImageError(true);
                        }
                      }
                    } else {
                      addDebug("No ad design found for this ad space through any method");
                      await debugAdSpaceDetails(adSpaceId);
                    }
                  }
                } catch (mobileQueryError) {
                  addDebug(`Mobile query exception: ${mobileQueryError}`);
                  
                  // Last resort for mobile: try to get any design by this user
                  try {
                    const { data: adSpaceUser } = await supabase
                      .from('ad_spaces')
                      .select('user_id')
                      .eq('id', adSpaceId)
                      .single();
                    
                    if (adSpaceUser?.user_id) {
                      const { data: userDesigns } = await supabase
                        .from('ad_designs')
                        .select('*')
                        .eq('user_id', adSpaceUser.user_id)
                        .order('created_at', { ascending: false })
                        .limit(1);
                      
                      if (userDesigns && userDesigns.length > 0) {
                        const firstDesign = {...userDesigns[0]};
                        
                        // Check for blob URLs and don't use them
                        if (isBlobUrl(firstDesign.image_url)) {
                          addDebug('Found blob URL for image in fallback design, ignoring it');
                          firstDesign.image_url = null;
                        }
                        
                        if (isBlobUrl(firstDesign.video_url)) {
                          addDebug('Found blob URL for video in fallback design, ignoring it');
                          firstDesign.video_url = null;
                        }
                        
                        addDebug(`Mobile last resort found design: ${firstDesign.id}`);
                        setAdDesign(firstDesign);
                        
                        // Try to update the relationship for future requests
                        try {
                          await supabase
                            .from('ad_designs')
                            .update({ ad_space_id: adSpaceId })
                            .eq('id', firstDesign.id);
                          
                          addDebug("Updated ad_space_id for future requests");
                        } catch (updateError) {
                          addDebug(`Failed to update relationship: ${updateError}`);
                        }
                      }
                    }
                  } catch (lastResortError) {
                    addDebug(`Mobile last resort failed: ${lastResortError}`);
                  }
                }
              } else {
                // Desktop approach - use the standard method
                try {
                  addDebug(`Fetching ad design for space: ${adSpaceId}`);
                  const adDesignData = await getAdDesignByAdSpaceId(adSpaceId);
                  
                  if (adDesignData) {
                    addDebug(`Ad design found with image: ${adDesignData.image_url ? 'yes' : 'no'}, video: ${adDesignData.video_url ? 'yes' : 'no'}`);
                    
                    // Check for blob URLs and don't use them
                    if (isBlobUrl(adDesignData.image_url)) {
                      addDebug('Found blob URL for image, ignoring it');
                      adDesignData.image_url = null;
                    }
                    
                    if (isBlobUrl(adDesignData.video_url)) {
                      addDebug('Found blob URL for video, ignoring it');
                      adDesignData.video_url = null;
                    }
                    
                    setAdDesign(adDesignData);
                    
                    // If this is a redirect ad design, use its redirect URL
                    if (adDesignData.content?.redirectUrl) {
                      finalRedirectUrl = adDesignData.content.redirectUrl;
                      addDebug(`Using redirect URL from ad design: ${finalRedirectUrl}`);
                    }

                    // Preload the media if available
                    if (adDesignData.image_url) {
                      addDebug(`Pre-fetching image: ${adDesignData.image_url}`);
                      const imgCache = new Image();
                      imgCache.src = adDesignData.image_url;
                    }

                    if (adDesignData.video_url) {
                      addDebug(`Video URL found: ${adDesignData.video_url}`);
                      // We don't preload video to avoid bandwidth issues
                    }
                  } else {
                    addDebug("No ad design found for this ad space through any method");
                    
                    // Extra debugging for this specific issue
                    await debugAdSpaceDetails(adSpaceId);
                  }
                } catch (designQueryError: any) {
                  addDebug(`Error fetching design: ${designQueryError.message}`);
                }
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

        // Debug database schema and data
        await debugAdDesignsSchema();
        
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
  }, [searchParams, isMobile, retryCount]);

  // Handle redirect countdown
  useEffect(() => {
    if (redirectUrl && !redirectClicked && redirectCountdown > 0) {
      const timer = setTimeout(() => {
        setRedirectCountdown(redirectCountdown - 1);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
    
    // Auto redirect when countdown reaches zero
    if (redirectUrl && !redirectClicked && redirectCountdown === 0) {
      handleRedirect();
    }
  }, [redirectUrl, redirectCountdown, redirectClicked]);

  // Special mobile retry logic - if no data is found, retry a few times
  useEffect(() => {
    if (!isLoading && isMobile && !adDesign && adData && retryCount < 3) {
      addDebug(`Mobile retry attempt ${retryCount + 1}`);
      
      const retryTimer = setTimeout(() => {
        setRetryCount(retryCount + 1);
      }, 1000); // Wait 1 second between retries
      
      return () => clearTimeout(retryTimer);
    }
  }, [isLoading, isMobile, adDesign, adData, retryCount]);

  // Pre-load image with better error handling specifically for mobile
  useEffect(() => {
    if (adDesign?.image_url && !isBlobUrl(adDesign.image_url)) {
      addDebug(`Preloading image: ${adDesign.image_url}`);
      
      // For mobile, we'll use our special mobile preloader
      if (isMobile) {
        const loadMobileImage = async () => {
          const success = await preloadImage(adDesign.image_url!);
          setImageLoaded(success);
          setImageError(!success);
        };
        
        loadMobileImage();
      } else {
        // Desktop approach
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
      }
    } else if (adDesign?.image_url && isBlobUrl(adDesign.image_url)) {
      addDebug("Ignoring blob URL for image");
      setImageError(true);
    } else {
      addDebug("No valid image URL to preload");
    }
  }, [adDesign?.image_url, isMobile]);

  // Handle video media
  useEffect(() => {
    if (adDesign?.video_url && !isBlobUrl(adDesign.video_url)) {
      addDebug(`Video URL detected: ${adDesign.video_url}`);
      // We don't preload video to save bandwidth, but we do update state
      setVideoLoaded(false); // Will be set to true on load event
    } else if (adDesign?.video_url && isBlobUrl(adDesign.video_url)) {
      addDebug("Ignoring blob URL for video");
      setVideoError(true);
    }
  }, [adDesign?.video_url]);

  // Manual redirect handler
  const handleRedirect = () => {
    if (!redirectUrl) return;
    
    try {
      addDebug(`Redirecting to: ${redirectUrl}`);
      // Use our safe redirect function
      const success = safeRedirect(redirectUrl);
      setRedirectClicked(true);
      
      if (!success) {
        addDebug("Safe redirect failed, showing manual option");
        setError('Unable to navigate automatically. Please click the link below to continue.');
      }
    } catch (err: any) {
      addDebug(`Navigation error: ${err.message}`);
      // If automatic navigation fails, show an error and encourage manual clicking
      setError('Unable to navigate automatically. Please click the link below to continue.');
    }
  };

  // Enhanced image error handler for mobile
  const handleImageError = () => {
    addDebug("Image error triggered by img onError event");
    setImageError(true);
  };

  // Handle image load success
  const handleImageLoad = () => {
    addDebug("Image load triggered by img onLoad event");
    setImageLoaded(true);
  };

  // Video handlers
  const handleVideoError = () => {
    addDebug("Video error triggered by video onError event");
    setVideoError(true);
  };

  const handleVideoLoad = () => {
    addDebug("Video loaded metadata event");
    setVideoLoaded(true);
  };

  // Try a different approach to load images on mobile
  const forceReloadImage = () => {
    if (!adDesign?.image_url || !imageRef.current || isBlobUrl(adDesign.image_url)) return;
    
    try {
      // Add a cache-busting parameter
      const cacheBuster = `?t=${Date.now()}`;
      imageRef.current.src = adDesign.image_url + cacheBuster;
      addDebug("Forcing image reload with cache-busting");
    } catch (err) {
      addDebug(`Force reload failed: ${err}`);
    }
  };

  // Try a different approach to load videos on mobile
  const forceReloadVideo = () => {
    if (!adDesign?.video_url || !videoRef.current || isBlobUrl(adDesign.video_url)) return;
    
    try {
      // Add a cache-busting parameter
      const cacheBuster = `?t=${Date.now()}`;
      videoRef.current.src = adDesign.video_url + cacheBuster;
      addDebug("Forcing video reload with cache-busting");
    } catch (err) {
      addDebug(`Force video reload failed: ${err}`);
    }
  };

  // Show debug info in development or when ?debug=true is in URL
  const showDebugInfo = import.meta.env.DEV || searchParams.get('debug') === 'true';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
          <p className="text-xs text-gray-500 mt-2">{deviceInfo}</p>
          {showDebugInfo && debug.length > 0 && <DebugPanel messages={debug} />}
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
          
          {showDebugInfo && <DebugPanel messages={debug} />}
        </div>
      </div>
    );
  }

  // Video ad display
  if (adDesign?.video_url && !isBlobUrl(adDesign.video_url) && !redirectUrl) {
    return (
      <div 
        className="min-h-screen flex flex-col items-center justify-center p-0 m-0 overflow-hidden"
        style={{ 
          backgroundColor: adData?.theme?.backgroundColor || '#f9fafb'
        }}
      >
        {!videoLoaded && !videoError && (
          <div className="flex flex-col items-center justify-center">
            <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading video...</p>
          </div>
        )}
        
        <div className="w-full h-full flex items-center justify-center">
          {videoError ? (
            // Fallback when video fails to load
            <div className="flex flex-col items-center justify-center">
              <svg width="120\" height="120\" viewBox="0 0 24 24\" fill="none\" stroke="currentColor\" strokeWidth="2\" strokeLinecap="round\" strokeLinejoin="round\" className="text-gray-400">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                <circle cx="12\" cy="12\" r="3"/>
                <line x1="2\" y1="2\" x2="22\" y2="22"/>
              </svg>
              <p className="text-gray-600 mt-4">Video could not be loaded</p>
              {isMobile && (
                <button 
                  onClick={forceReloadVideo}
                  className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-md"
                >
                  Try Again
                </button>
              )}
            </div>
          ) : (
            <video 
              ref={videoRef}
              src={adDesign.video_url}
              className="w-full max-w-4xl h-auto max-h-screen object-contain"
              controls
              autoPlay
              playsInline
              onLoadedMetadata={handleVideoLoad}
              onError={handleVideoError}
              crossOrigin="anonymous"
            />
          )}
        </div>

        {adData?.title && (
          <div className="fixed bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-4 text-center">
            <h1 className="text-xl font-bold">{adData.title}</h1>
            {adData.description && <p className="text-sm mt-1">{adData.description}</p>}
          </div>
        )}
        
        {showDebugInfo && <DebugPanel messages={debug} />}
      </div>
    );
  }

  // Image ad display
  if (adDesign?.image_url && !isBlobUrl(adDesign.image_url) && !redirectUrl) {
    return (
      <div 
        className="min-h-screen flex flex-col items-center justify-center p-0 m-0 overflow-hidden"
        style={{ 
          backgroundColor: adData?.theme?.backgroundColor || '#f9fafb'
        }}
      >
        {!imageLoaded && !imageError && (
          <div className="flex flex-col items-center justify-center">
            <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading image...</p>
            {isMobile && retryCount > 0 && (
              <p className="text-xs text-gray-500">Retry attempt {retryCount}/3</p>
            )}
          </div>
        )}
        
        <div className="w-full h-full flex items-center justify-center">
          {imageError ? (
            // Fallback image when the main one fails to load
            <div className="flex flex-col items-center justify-center">
              <img 
                src="/missing-image.svg"
                alt={adData?.title || "Advertisement"}
                className="w-full h-auto max-h-screen object-contain"
              />
              {isMobile && (
                <button 
                  onClick={forceReloadImage}
                  className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-md"
                >
                  Try Again
                </button>
              )}
            </div>
          ) : (
            <img 
              ref={imageRef}
              src={adDesign.image_url}
              alt={adData?.title || "Advertisement"}
              onLoad={handleImageLoad}
              onError={handleImageError}
              className={`w-full h-auto max-h-screen object-contain ${!imageLoaded ? 'hidden' : 'block'}`}
              crossOrigin="anonymous"
            />
          )}
        </div>

        {adData?.title && (imageLoaded || imageError) && (
          <div className="fixed bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-4 text-center">
            <h1 className="text-xl font-bold">{adData.title}</h1>
            {adData.description && <p className="text-sm mt-1">{adData.description}</p>}
          </div>
        )}
        
        {showDebugInfo && <DebugPanel messages={debug} />}
      </div>
    );
  }

  // Mobile-optimized redirect ad or ad space content display
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
        {(!redirectUrl && (!adDesign?.image_url || isBlobUrl(adDesign?.image_url)) && 
         (!adDesign?.video_url || isBlobUrl(adDesign?.video_url))) && (
          <div>
            <p className="text-lg font-medium p-4 bg-error-100 text-error-700 rounded-lg">
              This ad doesn't have any content to display
            </p>
            {(imageError || videoError) && (
              <p className="mt-4 text-sm text-gray-600">
                There was an error loading the media for this ad.
              </p>
            )}
            {isMobile && retryCount > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                Retry attempt {retryCount}/3
              </p>
            )}
          </div>
        )}
        
        {showDebugInfo && <DebugPanel messages={debug} />}
      </div>
    </div>
  );
};

export default View;