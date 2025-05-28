/**
 * Helper functions to ensure consistent mapping between ad spaces and ad designs
 */

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
 * Fetch an ad design by its ad space ID
 */
export const getAdDesignByAdSpaceId = async (adSpaceId: string): Promise<AdDesign | null> => {
  console.log(`Fetching ad design for ad space ID: ${adSpaceId}`);
  
  try {
    // First try to find by ad_space_id (this is the expected relationship)
    const { data, error } = await supabase
      .from('ad_designs')
      .select('*')
      .eq('ad_space_id', adSpaceId)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching ad design by ad_space_id:', error);
      return null;
    }
    
    if (data) {
      console.log('Found ad design by ad_space_id');
      return data;
    }
    
    // If not found, try to find by ID (fallback)
    const { data: directData, error: directError } = await supabase
      .from('ad_designs')
      .select('*')
      .eq('id', adSpaceId)
      .maybeSingle();
    
    if (directError) {
      console.error('Error fetching ad design by direct ID:', directError);
      return null;
    }
    
    if (directData) {
      console.log('Found ad design by direct ID match');
      return directData;
    }
    
    console.log('No ad design found for ad space ID');
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
    const { data, error } = await supabase
      .from('ad_designs')
      .select('id, ad_space_id, image_url')
      .limit(5);
    
    if (error) {
      console.error('Error fetching schema info:', error);
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
      return;
    }
    
    console.log('Ad space details:', adSpace);
    
    // Get linked ad design
    const adDesign = await getAdDesignByAdSpaceId(adSpaceId);
    console.log('Linked ad design:', adDesign);
    
  } catch (error) {
    console.error('Exception in debugAdSpaceDetails:', error);
  }
};