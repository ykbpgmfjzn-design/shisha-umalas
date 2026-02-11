import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Authenticate the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub;

    const xenditSecretKey = Deno.env.get('XENDIT_SECRET_KEY');
    if (!xenditSecretKey) {
      console.error('XENDIT_SECRET_KEY not configured');
      throw new Error('Payment service not configured');
    }

    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { purchaseId, amount, description, payerEmail, successRedirectUrl, failureRedirectUrl } = await req.json();

    console.log('Creating Xendit invoice for purchase:', purchaseId, 'amount:', amount);

    if (!purchaseId || !amount) {
      throw new Error('Missing required fields: purchaseId and amount');
    }

    // Verify purchase exists and belongs to the authenticated user
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .select('user_id')
      .eq('id', purchaseId)
      .single();

    if (purchaseError || !purchase) {
      return new Response(JSON.stringify({ error: 'Purchase not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (purchase.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized: purchase does not belong to you' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create external ID with purchase ID for tracking
    const externalId = `purchase_${purchaseId}_${Date.now()}`;

    // Create Xendit invoice
    const xenditResponse = await fetch('https://api.xendit.co/v2/invoices', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(xenditSecretKey + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        external_id: externalId,
        amount: amount,
        description: description || 'Hookah Lounge Order',
        payer_email: payerEmail,
        currency: 'IDR',
        success_redirect_url: successRedirectUrl,
        failure_redirect_url: failureRedirectUrl,
        invoice_duration: 86400, // 24 hours
        items: [
          {
            name: description || 'Order',
            quantity: 1,
            price: amount,
          }
        ],
      }),
    });

    if (!xenditResponse.ok) {
      const errorData = await xenditResponse.text();
      console.error('Xendit API error:', errorData);
      throw new Error(`Xendit API error: ${xenditResponse.status}`);
    }

    const invoiceData = await xenditResponse.json();
    console.log('Xendit invoice created:', invoiceData.id);

    // Update purchase with Xendit invoice details
    const { error: updateError } = await supabase
      .from('purchases')
      .update({
        xendit_invoice_id: invoiceData.id,
        xendit_invoice_url: invoiceData.invoice_url,
        payment_status: 'pending',
      })
      .eq('id', purchaseId);

    if (updateError) {
      console.error('Error updating purchase:', updateError);
    }

    return new Response(JSON.stringify({
      invoice_id: invoiceData.id,
      invoice_url: invoiceData.invoice_url,
      expiry_date: invoiceData.expiry_date,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating Xendit invoice:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
