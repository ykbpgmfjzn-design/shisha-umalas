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
    let purchaseId: string | null = null;
    
    if (purchaseIdMatch) {
      // Update by purchase ID
      purchaseId = purchaseIdMatch[1];
      console.log('Updating purchase by ID:', purchaseId, 'status:', status);
      
      updateResult = await supabase
        .from('purchases')
        .update({
          payment_status: status.toLowerCase(),
          paid_at: status === 'PAID' ? (paid_at || new Date().toISOString()) : null,
        })
        .eq('id', purchaseId);
    } else {
      // Fallback: Update by Xendit invoice ID
      console.log('Updating purchase by Xendit invoice ID:', id, 'status:', status);
      
      // First get the purchase to get its ID
      const { data: purchase } = await supabase
        .from('purchases')
        .select('id')
        .eq('xendit_invoice_id', id)
        .maybeSingle();
      
      if (purchase) {
        purchaseId = purchase.id;
      }
      
      updateResult = await supabase
        .from('purchases')
        .update({
          payment_status: status.toLowerCase(),
          paid_at: status === 'PAID' ? (paid_at || new Date().toISOString()) : null,
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

    // Send Telegram notification ONLY when payment is confirmed
    if (status === 'PAID' && purchaseId) {
      try {
        // Fetch purchase details for notification
        const { data: purchaseData } = await supabase
          .from('purchases')
          .select('*, profiles!purchases_user_id_fkey(room_number, email, full_name)')
          .eq('id', purchaseId)
          .maybeSingle();

        if (purchaseData) {
          const profile = purchaseData.profiles as { room_number?: string; email?: string; full_name?: string } | null;
          
          await fetch(`${supabaseUrl}/functions/v1/send-telegram-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              orderId: purchaseId,
              roomNumber: profile?.room_number || '',
              userEmail: profile?.email || '',
              hookahCount: purchaseData.hookah_count,
              totalAmount: purchaseData.amount,
              items: purchaseData.notes ? purchaseData.notes.split(', ').map((item: string) => {
                const match = item.match(/^(\d+)x (.+)$/);
                return match ? { name: match[2], quantity: parseInt(match[1]), price: 0 } : { name: item, quantity: 1, price: 0 };
              }) : [],
            }),
          });
          console.log('Telegram notification sent for paid order');
        }
      } catch (telegramError) {
        console.error('Failed to send Telegram notification:', telegramError);
        // Don't fail the webhook if notification fails
      }
    }

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
