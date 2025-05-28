/**
 * Mobile Compatibility Helpers
 * 
 * This file contains various utility functions to help with
 * mobile compatibility issues and ensure consistent behavior
 * across different devices and browsers.
 */

/**
 * Determines if the current device is a mobile device
 */
export const isMobileDevice = (): boolean => {
  const ua = navigator.userAgent;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
};

/**
 * Preloads an image with special handling for mobile devices
 */
export const preloadImage = async (imageUrl: string): Promise<boolean> => {
  if (!imageUrl) return false;

  // Use different approaches for mobile vs desktop
  if (isMobileDevice()) {
    try {
      // Fetch the image with CORS handling
      const response = await fetch(imageUrl, { 
        mode: 'cors',
        cache: 'force-cache'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load image: ${response.status}`);
      }
      
      return true;
    } catch (err) {
      console.error('Mobile image preload error:', err);
      return false;
    }
  } else {
    // Traditional approach for desktop
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = imageUrl;
    });
  }
};

/**
 * Safe redirect function that works across different mobile browsers
 */
export const safeRedirect = (url: string): boolean => {
  try {
    // For iOS WebView and Safari
    if (navigator.userAgent.match(/iPhone|iPad|iPod/i)) {
      window.location.href = url;
    } else {
      // For other browsers
      window.location.assign(url);
    }
    return true;
  } catch (err) {
    console.error('Redirect error:', err);
    return false;
  }
};

/**
 * Gets useful diagnostic information about the current device
 */
export const getDeviceInfo = (): { 
  isMobile: boolean; 
  browser: string; 
  os: string;
  viewportWidth: number;
  viewportHeight: number;
  pixelRatio: number;
} => {
  const ua = navigator.userAgent;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  
  const browser = 
    ua.includes('Chrome') ? 'Chrome' :
    ua.includes('Firefox') ? 'Firefox' :
    ua.includes('Safari') && !ua.includes('Chrome') ? 'Safari' :
    ua.includes('Edge') ? 'Edge' :
    'Unknown';
  
  const os = 
    ua.includes('Android') ? 'Android' :
    ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod') ? 'iOS' :
    ua.includes('Windows') ? 'Windows' :
    ua.includes('Mac') ? 'Mac' :
    ua.includes('Linux') ? 'Linux' :
    'Unknown';
  
  return {
    isMobile,
    browser,
    os,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    pixelRatio: window.devicePixelRatio || 1
  };
};