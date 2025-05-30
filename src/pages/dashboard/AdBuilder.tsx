import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import Card, { CardHeader, CardTitle, CardContent, CardFooter } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import QrCode from '../../components/ui/QrCode';
import MediaUpload from '../../components/ui/MediaUpload';
import { 
  Plus, 
  Trash2, 
  Save, 
  Eye,
  Link,
  QrCode as QrIcon,
  Edit,
  Image as ImageIcon,
  Film
} from 'lucide-react';
import toast from 'react-hot-toast';

interface AdDesign {
  id: string;
  name: string;
  template: string;
  created_at: string;
  background: string;
  content: {
    headline?: string;
    subheadline?: string;
    redirectUrl?: string;
  };
  image_url?: string;
  video_url?: string;
  ad_space_id?: string;
  ad_spaces?: {
    id: string;
    title: string;
    content: {
      url?: string;
      headline?: string;
      subheadline?: string;
    };
  } | null;
}

const AdBuilder = () => {
  const { user } = useAuthStore();
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'detail' | 'edit'>('list');
  const [selectedDesign, setSelectedDesign] = useState<AdDesign | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [savedDesigns, setSavedDesigns] = useState<AdDesign[]>([]);
  const previewRef = useRef<HTMLDivElement>(null);
  const [adMode, setAdMode] = useState<'custom' | 'redirect'>('custom');
  const [adForm, setAdForm] = useState({
    name: '',
    background: '#FFFFFF',
    redirectUrl: '',
    mediaFile: null as File | null,
    mediaPreview: '',
    isVideo: false
  });
  const [isUploading, setIsUploading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  useEffect(() => {
    fetchDesigns();
  }, []);

  useEffect(() => {
    // Pre-fill form when editing
    if (viewMode === 'edit' && selectedDesign) {
      const isRedirectMode = !selectedDesign.content.headline && 
        (selectedDesign.content.redirectUrl || selectedDesign.ad_spaces?.content?.url);
      
      // Determine if it's a video or image
      const hasVideo = !!selectedDesign.video_url;
      
      setAdMode(isRedirectMode ? 'redirect' : 'custom');
      
      setAdForm({
        name: selectedDesign.name || '',
        background: selectedDesign.background || '#FFFFFF',
        redirectUrl: selectedDesign.content.redirectUrl || selectedDesign.ad_spaces?.content?.url || '',
        mediaFile: null,
        mediaPreview: hasVideo ? selectedDesign.video_url || '' : selectedDesign.image_url || '',
        isVideo: hasVideo
      });
    }
  }, [viewMode, selectedDesign]);

  const addDebug = (message: string) => {
    console.log(`[AdBuilder Debug] ${message}`);
    setDebugInfo(prev => [...prev, message]);
  };

  const fetchDesigns = async () => {
    try {
      const { data, error } = await supabase
        .from('ad_designs')
        .select(`
          *,
          ad_spaces (
            id,
            title,
            content
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      addDebug(`Fetched ${data?.length || 0} ad designs`);
      setSavedDesigns(data || []);
    } catch (error) {
      toast.error('Failed to load designs');
      console.error('Error loading designs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateQrUrl = (adId: string) => {
    return `${window.location.origin}/view?ad=${adId}`;
  };

  const handleMediaUpload = async (file: File) => {
    if (!file) return;
    
    // Determine if it's a video or an image based on file type
    const isVideo = file.type.startsWith('video/');
    
    // Apply appropriate validations based on file type
    if (isVideo) {
      // Check file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        toast.error('Video too large. Maximum size is 50MB.');
        return;
      }
    } else {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image too large. Maximum size is 5MB.');
        return;
      }
      
      // Check dimensions
      try {
        const imageDimensions = await getImageDimensions(file);
        if (imageDimensions.width > 2500 || imageDimensions.height > 2500) {
          toast.warning('Image is very large. Consider using a smaller image for better performance.');
        }
      } catch (err) {
        console.error("Couldn't check image dimensions:", err);
      }
    }
    
    // Create object URL for preview
    const previewUrl = URL.createObjectURL(file);
    
    setAdForm(prev => ({
      ...prev,
      mediaFile: file,
      mediaPreview: previewUrl,
      isVideo: isVideo,
    }));
    
    addDebug(`${isVideo ? 'Video' : 'Image'} selected: ${file.name} (${Math.round(file.size / 1024)} KB)`);
  };

  // Helper function to get image dimensions
  const getImageDimensions = (file: File): Promise<{width: number, height: number}> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => {
        reject(new Error("Failed to load image"));
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    });
  };

  // Function to check if a URL is a blob URL
  const isBlobUrl = (url: string | null | undefined): boolean => {
    if (!url) return false;
    return url.startsWith('blob:');
  };

  const uploadMediaToStorage = async (file: File): Promise<{url: string | null, isVideo: boolean}> => {
    if (!file || !user) return {url: null, isVideo: false};
    
    const isVideo = file.type.startsWith('video/');
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;
    
    try {
      setIsUploading(true);
      addDebug(`Uploading ${isVideo ? 'video' : 'image'} to Supabase storage: ${fileName}`);
      
      // Compress image if it's very large (only for images)
      let fileToUpload = file;
      if (!isVideo && file.size > 2 * 1024 * 1024) { // If over 2MB
        try {
          fileToUpload = await compressImage(file);
          addDebug(`Compressed image from ${Math.round(file.size/1024)}KB to ${Math.round(fileToUpload.size/1024)}KB`);
        } catch (compressError) {
          addDebug(`Image compression failed: ${compressError}. Using original image.`);
        }
      }
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('ad_images')
        .upload(filePath, fileToUpload, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type
        });
      
      if (error) {
        addDebug(`Storage upload error: ${error.message}`);
        throw error;
      }
      
      addDebug(`Upload successful. Path: ${data?.path}`);
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('ad_images')
        .getPublicUrl(filePath);
      
      addDebug(`Generated public URL: ${publicUrl}`);
      return { url: publicUrl, isVideo };
    } catch (error: any) {
      console.error(`Error uploading ${isVideo ? 'video' : 'image'}:`, error);
      addDebug(`Upload failed: ${error.message}`);
      toast.error(`Failed to upload ${isVideo ? 'video' : 'image'}`);
      return { url: null, isVideo };
    } finally {
      setIsUploading(false);
    }
  };

  // Helper function to compress images
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Calculate new dimensions while maintaining aspect ratio
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Convert to blob with reduced quality
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Canvas to Blob conversion failed'));
                return;
              }
              
              // Create a new file from the blob
              const newFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              
              resolve(newFile);
            },
            'image/jpeg',
            0.8 // Quality parameter (0.8 = 80% quality)
          );
        };
        img.onerror = () => {
          reject(new Error('Error loading image for compression'));
        };
      };
      reader.onerror = () => {
        reject(new Error('Error reading file'));
      };
    });
  };

  const handleSaveAd = async () => {
    if (!adForm.name) {
      toast.error('Please provide a name for your ad');
      return;
    }

    // Only validate redirect URL for redirect mode
    if (adMode === 'redirect' && !adForm.redirectUrl) {
      toast.error('Please provide a redirect URL');
      return;
    }

    // For custom mode, media is required
    if (adMode === 'custom' && !adForm.mediaPreview) {
      toast.error('Please upload an image or video for your custom ad');
      return;
    }

    // Check for blob URLs
    if (isBlobUrl(adForm.mediaPreview)) {
      if (!adForm.mediaFile) {
        toast.error('Please upload the media again. Temporary URLs cannot be stored.');
        return;
      }
    }

    setIsSaving(true);
    addDebug(`Starting save process for ad: ${adForm.name}, mode: ${adMode}`);

    try {
      // Upload media if there's a new file
      let imageUrl = '';
      let videoUrl = '';
      
      // Don't use blob URLs
      if (!isBlobUrl(adForm.mediaPreview)) {
        if (adForm.isVideo) {
          videoUrl = adForm.mediaPreview;
        } else {
          imageUrl = adForm.mediaPreview;
        }
      }
      
      // Upload new media if it exists
      if (adForm.mediaFile) {
        const { url, isVideo } = await uploadMediaToStorage(adForm.mediaFile);
        
        if (url) {
          if (isVideo) {
            videoUrl = url;
            imageUrl = '';
            addDebug(`New video URL: ${videoUrl}`);
          } else {
            imageUrl = url;
            videoUrl = '';
            addDebug(`New image URL: ${imageUrl}`);
          }
        } else {
          addDebug('Media upload failed');
          throw new Error('Failed to upload media');
        }
      }

      // Make sure we're not using blob URLs
      if (imageUrl && isBlobUrl(imageUrl)) {
        addDebug('Detected blob URL for image, clearing it');
        imageUrl = '';
      }
      
      if (videoUrl && isBlobUrl(videoUrl)) {
        addDebug('Detected blob URL for video, clearing it');
        videoUrl = '';
      }

      // Check if we're editing or creating new
      const isEditing = viewMode === 'edit' && selectedDesign;
      
      // STEP 1: Create or update the ad space
      addDebug(`STEP 1: ${isEditing ? 'Updating' : 'Creating'} ad space`);
      
      const adSpaceData = {
        user_id: user?.id,
        title: adForm.name,
        description: `Ad space for ${adForm.name}`,
        content: adMode === 'custom' 
          ? {}
          : {
              url: adForm.redirectUrl
            },
        theme: {
          backgroundColor: adForm.background,
          textColor: '#FFFFFF'
        }
      };
      
      let adSpaceId = selectedDesign?.ad_space_id;
      
      if (isEditing && adSpaceId) {
        // Update existing ad space
        addDebug(`Updating existing ad space ID: ${adSpaceId}`);
        const { error: adSpaceError } = await supabase
          .from('ad_spaces')
          .update(adSpaceData)
          .eq('id', adSpaceId);
          
        if (adSpaceError) {
          addDebug(`Ad space update error: ${adSpaceError.message}`);
          throw adSpaceError;
        }
        addDebug('Ad space updated successfully');
      } else {
        // Create new ad space
        addDebug('Creating new ad space');
        const { data: adSpace, error: adSpaceError } = await supabase
          .from('ad_spaces')
          .insert([adSpaceData])
          .select()
          .single();

        if (adSpaceError) {
          addDebug(`Ad space creation error: ${adSpaceError.message}`);
          throw adSpaceError;
        }
        
        if (!adSpace || !adSpace.id) {
          addDebug('Ad space creation failed: No ID returned');
          throw new Error('Failed to create ad space - no ID returned');
        }
        
        adSpaceId = adSpace.id;
        addDebug(`New ad space created with ID: ${adSpaceId}`);
      }

      // STEP 2: Create or update the ad design
      addDebug(`STEP 2: ${isEditing ? 'Updating' : 'Creating'} ad design with ad_space_id: ${adSpaceId}`);
      
      // CRITICAL: Explicitly include image_url, video_url, and ad_space_id in the record
      const adDesignData = {
        user_id: user?.id,
        name: adForm.name,
        background: adForm.background,
        content: adMode === 'custom'
          ? {}
          : {
              redirectUrl: adForm.redirectUrl
            },
        ad_space_id: adSpaceId,
        image_url: imageUrl,
        video_url: videoUrl
      };
      
      addDebug(`Ad design data being saved: ${JSON.stringify({
        ...adDesignData,
        user_id: 'REDACTED' // Don't log the actual user ID
      })}`);
      
      if (isEditing && selectedDesign?.id) {
        // Update existing design
        addDebug(`Updating existing ad design ID: ${selectedDesign.id}`);
        
        const { data: adDesign, error: adError } = await supabase
          .from('ad_designs')
          .update(adDesignData)
          .eq('id', selectedDesign.id)
          .select(`
            *,
            ad_spaces (
              id,
              title,
              content
            )
          `)
          .single();
          
        if (adError) {
          addDebug(`Ad design update error: ${adError.message}`);
          console.error('AD_BUILDER_SUPABASE_ERROR [ad_designs update]:', JSON.stringify(adError, null, 2));
          throw adError;
        }
        
        if (!adDesign) {
          addDebug('Ad design update returned no data');
          console.warn('AD_BUILDER_SUPABASE_WARN [ad_designs update]: No data returned from update');
        } else {
          addDebug(`Ad design updated successfully with ID: ${adDesign.id}`);
          addDebug(`Updated ad design has image_url: ${adDesign.image_url ? 'yes' : 'no'}`);
          addDebug(`Updated ad design has video_url: ${adDesign.video_url ? 'yes' : 'no'}`);
          addDebug(`Updated ad design has ad_space_id: ${adDesign.ad_space_id ? adDesign.ad_space_id : 'no'}`);
          
          console.log('AD_BUILDER_SUPABASE_SUCCESS [ad_designs update]: Updated ad_design data:', JSON.stringify(adDesign, null, 2));
          console.log('AD_BUILDER_VERIFY_LINK: ad_design.id =', adDesign.id, '; ad_design.ad_space_id =', adDesign.ad_space_id);
          
          // Update the design in the local state
          setSavedDesigns(prev => 
            prev.map(design => 
              design.id === adDesign.id ? adDesign : design
            )
          );
        }
        
        toast.success('Ad design updated!');
      } else {
        // Create new design
        addDebug('Creating new ad design');
        
        const { data: adDesign, error: adError } = await supabase
          .from('ad_designs')
          .insert([adDesignData])
          .select(`
            *,
            ad_spaces (
              id,
              title,
              content
            )
          `)
          .single();

        if (adError) {
          addDebug(`Ad design creation error: ${adError.message}`);
          console.error('AD_BUILDER_SUPABASE_ERROR [ad_designs insert]:', JSON.stringify(adError, null, 2));
          throw adError;
        }
        
        if (!adDesign) {
          addDebug('Ad design creation returned no data');
          console.warn('AD_BUILDER_SUPABASE_WARN [ad_designs insert]: No data returned from insert');
        } else {
          addDebug(`New ad design created with ID: ${adDesign.id}`);
          addDebug(`New ad design has image_url: ${adDesign.image_url ? 'yes' : 'no'}`);
          addDebug(`New ad design has video_url: ${adDesign.video_url ? 'yes' : 'no'}`);
          addDebug(`New ad design has ad_space_id: ${adDesign.ad_space_id ? adDesign.ad_space_id : 'no'}`);
          
          // Log the successful save with detailed information
          console.log('AD_BUILDER_SUPABASE_SUCCESS [ad_designs insert]: Saved ad_design data:', JSON.stringify(adDesign, null, 2));
          console.log('AD_BUILDER_VERIFY_LINK: ad_design.id =', adDesign.id, '; ad_design.ad_space_id =', adDesign.ad_space_id);
          
          setSavedDesigns(prev => [adDesign, ...prev]);
        }
        
        toast.success('Ad design created!');
      }
      
      // STEP 3: Verify data was saved correctly
      addDebug('STEP 3: Verifying data was saved correctly');
      await verifyAdDesignSaved(adSpaceId);
      
      setViewMode('list');
      
      // Reset form
      resetForm();
    } catch (error: any) {
      console.error('Save error:', error);
      addDebug(`Save error: ${error.message}`);
      toast.error(error.message || 'Failed to save design');
    } finally {
      setIsSaving(false);
    }
  };

  const verifyAdDesignSaved = async (adSpaceId: string) => {
    try {
      addDebug(`Verifying ad design was saved with ad_space_id: ${adSpaceId}`);
      
      // First try: Direct query with ad_space_id
      const { data, error } = await supabase
        .from('ad_designs')
        .select('id, image_url, video_url, ad_space_id')
        .eq('ad_space_id', adSpaceId)
        .maybeSingle();
      
      if (error) {
        addDebug(`Verification query error: ${error.message}`);
      } else if (data) {
        addDebug(`Verification successful: Found ad design ID ${data.id}`);
        addDebug(`Verification details: image_url=${data.image_url ? 'present' : 'missing'}, video_url=${data.video_url ? 'present' : 'missing'}, ad_space_id=${data.ad_space_id}`);
        return;
      } else {
        addDebug('Verification failed: No ad design found with this ad_space_id');
      }
      
      // Second try: Get all ad designs for this user
      const { data: userDesigns, error: userError } = await supabase
        .from('ad_designs')
        .select('id, ad_space_id, image_url, video_url')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (userError) {
        addDebug(`Error querying user designs: ${userError.message}`);
      } else {
        addDebug(`Found ${userDesigns?.length || 0} ad designs for this user`);
        if (userDesigns && userDesigns.length > 0) {
          const relatedDesigns = userDesigns.filter(d => d.ad_space_id === adSpaceId);
          addDebug(`Found ${relatedDesigns.length} designs linked to this ad space`);
          
          if (relatedDesigns.length > 0) {
            addDebug(`Linked design details: ${JSON.stringify(relatedDesigns[0])}`);
          } else {
            addDebug(`Most recent design created: ${JSON.stringify(userDesigns[0])}`);
          }
        }
      }
      
      // Third try: Query the database schema to check column names
      const { data: schemaData, error: schemaError } = await supabase
        .from('ad_designs')
        .select()
        .limit(1);
      
      if (schemaError) {
        addDebug(`Schema query error: ${schemaError.message}`);
      } else if (schemaData && schemaData.length > 0) {
        addDebug(`Database schema columns: ${Object.keys(schemaData[0]).join(', ')}`);
      }
    } catch (err: any) {
      addDebug(`Verification exception: ${err.message}`);
    }
  };

  const resetForm = () => {
    setAdForm({
      name: '',
      background: '#FFFFFF',
      redirectUrl: '',
      mediaFile: null,
      mediaPreview: '',
      isVideo: false
    });
    setAdMode('custom');
    setSelectedDesign(null);
  };

  const handleDeleteAd = async (id: string) => {
    try {
      const { error } = await supabase
        .from('ad_designs')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSavedDesigns(prev => prev.filter(design => design.id !== id));
      if (selectedDesign?.id === id) {
        resetForm();
        setViewMode('list');
      }
      toast.success('Design deleted');
    } catch (error) {
      toast.error('Failed to delete design');
    }
  };
  
  const handleEditAd = (design: AdDesign) => {
    setSelectedDesign(design);
    setViewMode('edit');
  };

  const clearMedia = () => {
    setAdForm(prev => ({
      ...prev,
      mediaFile: null,
      mediaPreview: ''
    }));
  };

  const renderAdList = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Ad Designs</h1>
        <Button 
          onClick={() => {
            resetForm();
            setViewMode('create');
          }} 
          leftIcon={<Plus size={16} />}
        >
          Create New Ad
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading designs...</p>
        </div>
      ) : savedDesigns.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-gray-600 mb-4">No ad designs yet. Create your first one!</p>
            <Button 
              onClick={() => {
                resetForm();
                setViewMode('create');
              }} 
              leftIcon={<Plus size={16} />}
            >
              Create New Ad
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedDesigns.map((design) => (
            <Card key={design.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>{design.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  className="aspect-video rounded-md p-4 mb-4 relative overflow-hidden"
                  style={{ backgroundColor: design.background }}
                >
                  {design.image_url && !isBlobUrl(design.image_url) && (
                    <img 
                      src={design.image_url} 
                      alt="" 
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                      crossOrigin="anonymous"
                    />
                  )}
                  {design.video_url && !isBlobUrl(design.video_url) && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Film size={48} className="text-white opacity-70" />
                    </div>
                  )}
                  <div className="relative z-10 flex items-center justify-center h-full">
                    {design.content.redirectUrl || design.ad_spaces?.content?.url ? (
                      <div className="text-center">
                        <p className="text-sm text-white bg-black bg-opacity-30 p-2 rounded">
                          {design.content.redirectUrl || design.ad_spaces?.content?.url}
                        </p>
                      </div>
                    ) : (
                      (design.image_url || design.video_url) && (
                        <div className="text-center">
                          <p className="text-sm text-white bg-black bg-opacity-30 p-2 rounded">
                            Custom Ad
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-500">
                    Created: {new Date(design.created_at).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSelectedDesign(design);
                      setViewMode('detail');
                    }}
                    leftIcon={<Eye size={16} />}
                  >
                    View
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => handleEditAd(design)}
                    leftIcon={<Edit size={16} />}
                  >
                    Edit
                  </Button>
                </div>
                <Button 
                  variant="outline"
                  className="text-error-500 hover:bg-error-50"
                  onClick={() => handleDeleteAd(design.id)}
                  leftIcon={<Trash2 size={16} />}
                >
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderAdDetail = () => {
    if (!selectedDesign?.ad_spaces?.id) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-600">Ad space information not available</p>
          <Button 
            variant="outline" 
            onClick={() => setViewMode('list')} 
            className="mt-4"
          >
            Back to List
          </Button>
        </div>
      );
    }

    const qrUrl = generateQrUrl(selectedDesign.ad_spaces.id);
    const redirectUrl = selectedDesign.content.redirectUrl || selectedDesign.ad_spaces.content.url;
    const isRedirectMode = !!redirectUrl;
    const hasVideo = !!selectedDesign.video_url;

    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => setViewMode('list')}>
            Back to List
          </Button>
          <h1 className="text-2xl font-bold">{selectedDesign.name}</h1>
          <Button 
            variant="outline"
            onClick={() => handleEditAd(selectedDesign)}
            leftIcon={<Edit size={16} />}
          >
            Edit
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                ref={previewRef}
                className="aspect-video rounded-lg p-8 relative overflow-hidden"
                style={{ backgroundColor: selectedDesign.background }}
              >
                {selectedDesign.image_url && !isBlobUrl(selectedDesign.image_url) && (
                  <img 
                    src={selectedDesign.image_url} 
                    alt="" 
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                    crossOrigin="anonymous"
                  />
                )}
                {selectedDesign.video_url && !isBlobUrl(selectedDesign.video_url) && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <video 
                      src={selectedDesign.video_url}
                      controls
                      className="w-full h-full object-contain"
                      crossOrigin="anonymous"
                    />
                  </div>
                )}
                <div className="relative z-10 flex items-center justify-center h-full">
                  {isRedirectMode && redirectUrl ? (
                    <div className="text-center">
                      <p className="text-white bg-black bg-opacity-30 p-3 rounded">
                        {redirectUrl}
                      </p>
                    </div>
                  ) : (selectedDesign.image_url || selectedDesign.video_url) ? (
                    <div className="text-center">
                      <p className="text-white bg-black bg-opacity-30 p-3 rounded">
                        Custom Ad
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>QR Code</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <QrCode
                  value={qrUrl}
                  size={200}
                  level="H"
                  includeMargin
                />
                <p className="mt-4 text-sm text-gray-600">
                  Scan this QR code to view the ad
                </p>
                <p className="mt-2 text-xs text-gray-500 break-all">
                  {qrUrl}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Name</h3>
                  <p>{selectedDesign.name}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Created</h3>
                  <p>{new Date(selectedDesign.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Background Color</h3>
                  <div className="flex items-center mt-1">
                    <div 
                      className="w-6 h-6 rounded border"
                      style={{ backgroundColor: selectedDesign.background }}
                    />
                    <span className="ml-2">{selectedDesign.background}</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Media Type</h3>
                  <p>{hasVideo ? 'Video' : 'Image'}</p>
                </div>
                <div>
                  {isRedirectMode ? (
                    <>
                      <h3 className="text-sm font-medium text-gray-500">Redirect URL</h3>
                      {redirectUrl ? (
                        <p className="mt-1 break-all">{redirectUrl}</p>
                      ) : (
                        <p className="mt-1 text-gray-400 italic">No redirect URL set</p>
                      )}
                    </>
                  ) : (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Type</h3>
                      <p>Custom Ad</p>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Ad Space ID</h3>
                  <p className="text-xs font-mono break-all">{selectedDesign.ad_spaces.id}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Ad Design ID</h3>
                  <p className="text-xs font-mono break-all">{selectedDesign.id}</p>
                </div>
                {selectedDesign.image_url && !isBlobUrl(selectedDesign.image_url) && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Image URL</h3>
                    <p className="text-xs font-mono break-all">{selectedDesign.image_url}</p>
                  </div>
                )}
                {selectedDesign.video_url && !isBlobUrl(selectedDesign.video_url) && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Video URL</h3>
                    <p className="text-xs font-mono break-all">{selectedDesign.video_url}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  };

  const renderAdCreator = () => (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="outline" onClick={() => setViewMode('list')}>
          Back to List
        </Button>
        <h1 className="text-2xl font-bold">{viewMode === 'edit' ? 'Edit Ad' : 'Create New Ad'}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ad Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Ad Name"
              type="text"
              value={adForm.name}
              onChange={(e) => setAdForm({ ...adForm, name: e.target.value })}
              placeholder="Enter ad name"
            />

            <div className="pt-2">
              <label className="block text-sm font-medium mb-2">Ad Type</label>
              <div className="flex space-x-4 mb-4">
                <div 
                  className={`p-3 border rounded-md cursor-pointer flex-1 text-center ${adMode === 'custom' ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}
                  onClick={() => setAdMode('custom')}
                >
                  <h3 className="font-medium text-sm">Custom Ad</h3>
                </div>
                <div 
                  className={`p-3 border rounded-md cursor-pointer flex-1 text-center ${adMode === 'redirect' ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}
                  onClick={() => setAdMode('redirect')}
                >
                  <h3 className="font-medium text-sm">Redirect Only</h3>
                </div>
              </div>
            </div>

            {adMode === 'custom' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Background Color
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      value={adForm.background}
                      onChange={(e) => setAdForm({ ...adForm, background: e.target.value })}
                      className="h-8 w-12 cursor-pointer border-0"
                    />
                    <input
                      type="text"
                      value={adForm.background}
                      onChange={(e) => setAdForm({ ...adForm, background: e.target.value })}
                      className="input text-sm"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Upload Media (Image or Video)
                  </label>
                  <MediaUpload 
                    onUpload={handleMediaUpload}
                    preview={adForm.mediaPreview}
                    previewType={adForm.isVideo ? 'video' : 'image'}
                    onClear={clearMedia}
                    className="border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            ) : (
              <Input
                label="Redirect URL"
                value={adForm.redirectUrl}
                onChange={(e) => setAdForm({ ...adForm, redirectUrl: e.target.value })}
                placeholder="Enter the URL where users will be redirected"
                leftIcon={<Link size={16} />}
              />
            )}
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleSaveAd} 
              className="w-full" 
              leftIcon={<Save size={16} />}
              isLoading={isSaving || isUploading}
              disabled={isSaving || isUploading}
            >
              {viewMode === 'edit' ? 'Update Ad Design' : 'Save Ad Design'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
  
  // Reuse the same form for editing, but with different title and button text
  const renderAdEditor = () => {
    return renderAdCreator();
  };

  return (
    <div>
      {viewMode === 'list' && renderAdList()}
      {viewMode === 'detail' && renderAdDetail()}
      {viewMode === 'create' && renderAdCreator()}
      {viewMode === 'edit' && renderAdEditor()}
      
      {/* Debug info for development */}
      {import.meta.env.DEV && debugInfo.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 w-80 bg-black bg-opacity-80 text-white rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-700">
            <h3 className="text-sm font-semibold">Debug Info</h3>
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            <ul className="text-xs space-y-1">
              {debugInfo.slice(-10).map((msg, i) => (
                <li key={i} className="border-b border-gray-700 pb-1 break-words">
                  {msg}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdBuilder;