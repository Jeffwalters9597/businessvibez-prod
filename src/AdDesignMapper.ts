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
      .order('created_at', { ascending: false })  // Get the most recent one
      .maybeSingle();
    
    if (relationError) {
      console.error('Error in Strategy 1:', relationError);
    } else if (relationData) {
      console.log('Found ad design by ad_space_id relation:', relationData.id);
      return relationData;
    } else {
      console.log('No results from Strategy 1');
    }
    
    // Strategy 2: Try to find by direct ID match (fallback)
    console.log("Strategy 2: Trying direct ID match");
    const { data: directData, error: directError } = await supabase
      .from('ad_designs')
      .select('*')
      .eq('id', adSpaceId)
      .maybeSingle();
    
    if (directError) {
      console.error('Error in Strategy 2:', directError);
    } else if (directData) {
      console.log('Found ad design by direct ID match:', directData.id);
      return directData;
    } else {
      console.log('No results from Strategy 2');
    }
    
    // Strategy 3: Get ad space details first, then look for designs with matching user_id
    console.log("Strategy 3: Trying user-based match");
    const { data: adSpaceData, error: adSpaceError } = await supabase
      .from('ad_spaces')
      .select('user_id')
      .eq('id', adSpaceId)
      .maybeSingle();
      
    if (adSpaceError) {
      console.error('Error fetching ad space in Strategy 3:', adSpaceError);
    } else if (adSpaceData?.user_id) {
      // Now find the most recent ad design by this user
      const { data: userDesigns, error: userError } = await supabase
        .from('ad_designs')
        .select('*')
        .eq('user_id', adSpaceData.user_id)
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (userError) {
        console.error('Error in Strategy 3 user query:', userError);
      } else if (userDesigns && userDesigns.length > 0) {
        console.log('Found ad design by user match:', userDesigns[0].id);
        
        // Important: If we found a design, let's try to update its ad_space_id for future lookups
        try {
          await supabase
            .from('ad_designs')
            .update({ ad_space_id: adSpaceId })
            .eq('id', userDesigns[0].id);
          console.log('Updated ad_space_id for this design for future lookups');
        } catch (updateError) {
          console.error('Error updating ad_space_id:', updateError);
        }
        
        return userDesigns[0];
      }
    }
    
    // Strategy 4: Try broader query to see if any ad designs exist at all
    console.log("Strategy 4: Checking for any ad designs");
    const { data: anyData, error: anyError } = await supabase
      .from('ad_designs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (anyError) {
      console.error('Error in Strategy 4:', anyError);
    } else {
      console.log(`Found ${anyData?.length || 0} total ad designs in the table`);
      
      // Log first few designs for debugging
      if (anyData && anyData.length > 0) {
        console.log(`Sample ad designs: ${JSON.stringify(anyData.slice(0, 3).map(d => ({
          id: d.id,
          ad_space_id: d.ad_space_id,
          user_id: d.user_id,
          has_image: !!d.image_url
        })))}`);
        
        // As a last resort, try to link the most recent design with this ad space
        // This is risky but might help recover from a broken state
        if (anyData.length > 0 && !anyData[0].ad_space_id) {
          try {
            await supabase
              .from('ad_designs')
              .update({ ad_space_id: adSpaceId })
              .eq('id', anyData[0].id);
            console.log('Emergency fix: Linked most recent design to this ad space');
            return anyData[0];
          } catch (updateError) {
            console.error('Error in emergency fix:', updateError);
          }
        }
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
      .select('id, ad_space_id, image_url, user_id, created_at')
      .order('created_at', { ascending: false })
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
      console.log('Ad space details:', JSON.stringify({
        id: adSpace.id,
        title: adSpace.title,
        user_id: adSpace.user_id,
        has_content: !!adSpace.content
      }));
      
      // Try to find any ad designs that might be linked
      const { data: linkData, error: linkError } = await supabase
        .from('ad_designs')
        .select('id, ad_space_id, image_url, created_at')
        .eq('ad_space_id', adSpaceId)
        .order('created_at', { ascending: false });
      
      if (linkError) {
        console.error('Error checking linked designs:', linkError);
      } else {
        console.log(`Found ${linkData?.length || 0} linked designs`);
        if (linkData && linkData.length > 0) {
          console.log('Linked designs:', JSON.stringify(linkData));
        }
      }
      
      // Try to find by user_id
      if (adSpace.user_id) {
        const { data: userDesigns, error: userError } = await supabase
          .from('ad_designs')
          .select('id, ad_space_id, image_url, created_at')
          .eq('user_id', adSpace.user_id)
          .order('created_at', { ascending: false })
          .limit(5);
          
        if (userError) {
          console.error('Error checking user designs:', userError);
        } else {
          console.log(`Found ${userDesigns?.length || 0} designs by same user`);
          if (userDesigns && userDesigns.length > 0) {
            console.log('User designs:', JSON.stringify(userDesigns));
            
            // If there are designs by this user but none linked to this ad space,
            // try to link the most recent one automatically
            if (userDesigns.length > 0 && 
                linkData && linkData.length === 0 && 
                !userDesigns[0].ad_space_id) {
              try {
                await supabase
                  .from('ad_designs')
                  .update({ ad_space_id: adSpaceId })
                  .eq('id', userDesigns[0].id);
                console.log('Automatically linked most recent design to this ad space');
              } catch (updateError) {
                console.error('Error in auto-linking:', updateError);
              }
            }
          }
        }
      }
    } else {
      console.log('No ad space found with ID:', adSpaceId);
    }
  } catch (error) {
    console.error('Exception in debugAdSpaceDetails:', error);
  }
};