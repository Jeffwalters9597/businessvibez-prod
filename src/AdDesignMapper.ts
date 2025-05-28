import { supabase } from './lib/supabase';

interface AdSpace {
  id: string;
  title: string;
  content: Record<string, any>;
}

interface AdDesign {
  id: string;
  ad_space_id: string;
  image_url?: string;
  content: Record<string, any>;
}

/**
 * Fetch an ad design by its ad space ID using multiple fallback strategies
 */
export const getAdDesignByAdSpaceId = async (adSpaceId: string): Promise<AdDesign | null> => {
  console.log(`Fetching ad design for ad space ID: ${adSpaceId}`);
  
  try {
    // Strategy 1: First try to find by ad_space_id (this is the expected relationship)
    console.log("Strategy 1: Trying ad_space_id foreign key relationship");
    const { data: relationData, error: relationError } = await supabase
      .from('ad_designs')
      .select('*')
      .eq('ad_space_id', adSpaceId)
      .maybeSingle();
    
    if (relationError) {
      console.error('Error in Strategy 1:', relationError);
    } else if (relationData) {
      console.log('Found ad design by ad_space_id relation');
      return relationData;
    } else {
      console.log('No results from Strategy 1');
    }
    
    // Strategy 2: Try to find by direct ID match
    console.log("Strategy 2: Trying direct ID match");
    const { data: directData, error: directError } = await supabase
      .from('ad_designs')
      .select('*')
      .eq('id', adSpaceId)
      .maybeSingle();
    
    if (directError) {
      console.error('Error in Strategy 2:', directError);
    } else if (directData) {
      console.log('Found ad design by direct ID match');
      return directData;
    } else {
      console.log('No results from Strategy 2');
    }
    
    // Strategy 3: Try broader query to see if any ad designs exist at all
    console.log("Strategy 3: Checking for any ad designs linked to this space");
    const { data: anyData, error: anyError } = await supabase
      .from('ad_designs')
      .select('*')
      .limit(10);
    
    if (anyError) {
      console.error('Error in Strategy 3:', anyError);
    } else {
      console.log(`Found ${anyData?.length || 0} total ad designs in the table`);
      if (anyData && anyData.length > 0) {
        console.log(`Sample ad designs: ${JSON.stringify(anyData.map(d => ({
          id: d.id,
          ad_space_id: d.ad_space_id,
          has_image: !!d.image_url
        })))}`);
      }
    }
    
    console.log('No ad design found for ad space ID after all strategies');
    return null;
  } catch (error) {
    console.error('Exception in getAdDesignByAdSpaceId:', error);
    return null;
  }
};

/**
 * Debug function to log the database schema for ad_designs
 */
export const debugAdDesignsSchema = async (): Promise<void> => {
  try {
    // First get column info
    const { data: columnsData, error: columnsError } = await supabase
      .from('ad_designs')
      .select()
      .limit(1);
    
    if (columnsError) {
      console.error('Error fetching schema info:', columnsError);
    } else if (columnsData && columnsData.length > 0) {
      console.log('Schema columns:', Object.keys(columnsData[0]));
    } else {
      console.log('No data found for schema inspection');
    }
    
    // Then get a few sample rows
    const { data, error } = await supabase
      .from('ad_designs')
      .select('id, ad_space_id, image_url')
      .limit(5);
    
    if (error) {
      console.error('Error fetching sample data:', error);
    } else {
      console.log('Schema sample (ad_designs):', JSON.stringify(data));
    }
  } catch (error) {
    console.error('Schema query error:', error);
  }
};

/**
 * Debug function to log details about a specific ad space and its linked design
 */
export const debugAdSpaceDetails = async (adSpaceId: string): Promise<void> => {
  console.log(`Debugging ad space: ${adSpaceId}`);
  
  try {
    // Get ad space
    const { data: adSpace, error: adSpaceError } = await supabase
      .from('ad_spaces')
      .select('*')
      .eq('id', adSpaceId)
      .maybeSingle();
    
    if (adSpaceError) {
      console.error('Error fetching ad space:', adSpaceError);
    } else if (adSpace) {
      console.log('Ad space details:', adSpace);
      
      // Check which columns exist
      console.log('Ad space columns:', Object.keys(adSpace));
      
      // Try to find any ad designs that might be linked
      const { data: linkData, error: linkError } = await supabase
        .from('ad_designs')
        .select('*')
        .eq('ad_space_id', adSpaceId);
      
      if (linkError) {
        console.error('Error checking linked designs:', linkError);
      } else {
        console.log(`Found ${linkData?.length || 0} linked designs`);
        if (linkData && linkData.length > 0) {
          console.log('First linked design:', linkData[0]);
        }
      }
    } else {
      console.log('No ad space found with ID:', adSpaceId);
    }
  } catch (error) {
    console.error('Exception in debugAdSpaceDetails:', error);
  }
};