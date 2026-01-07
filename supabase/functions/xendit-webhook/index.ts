import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-callback-token',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log('Xendit webhook received:', JSON.stringify(payload));

    const { id, external_id, status, paid_at, payment_method, payment_channel } = payload;

    if (!id || !external_id) {
      console.error('Missing required webhook fields');
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract purchase ID from external_id (format: purchase_{purchaseId}_{timestamp})
    const purchaseIdMatch = external_id.match(/^purchase_([a-f0-9-]+)_/);
    
    let updateResult;
    
    if (purchaseIdMatch) {
      // Update by purchase ID
      const purchaseId = purchaseIdMatch[1];
      console.log('Updating purchase by ID:', purchaseId, 'status:', status);
      
      updateResult = await supabase
        .from('purchases')
        .update({
          payment_status: status.toLowerCase(),
          paid_at: status === 'PAID' ? (paid_at || new Date().toISOString()) : null,
          notes: `Payment via ${payment_method || 'unknown'} - ${payment_channel || 'unknown'}`,
        })
        .eq('id', purchaseId);
    } else {
      // Fallback: Update by Xendit invoice ID
      console.log('Updating purchase by Xendit invoice ID:', id, 'status:', status);
      
      updateResult = await supabase
        .from('purchases')
        .update({
          payment_status: status.toLowerCase(),
          paid_at: status === 'PAID' ? (paid_at || new Date().toISOString()) : null,
          notes: `Payment via ${payment_method || 'unknown'} - ${payment_channel || 'unknown'}`,
        })
        .eq('xendit_invoice_id', id);
    }

    if (updateResult.error) {
      console.error('Error updating purchase:', updateResult.error);
      return new Response(JSON.stringify({ error: 'Failed to update purchase' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Purchase updated successfully');

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
