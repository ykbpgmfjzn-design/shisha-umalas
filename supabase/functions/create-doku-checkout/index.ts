import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckoutRequest {
  purchaseId: string;
  amount: number;
  description: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  items?: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
}

function generateRequestId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function generateSignature(
  clientId: string,
  requestId: string,
  requestTimestamp: string,
  requestTarget: string,
  digest: string,
  secretKey: string
): Promise<string> {
  const componentSignature = `Client-Id:${clientId}\nRequest-Id:${requestId}\nRequest-Timestamp:${requestTimestamp}\nRequest-Target:${requestTarget}\nDigest:${digest}`;
  
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const data = encoder.encode(componentSignature);
  
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", key, data);
  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  return `HMACSHA256=${base64Signature}`;
}

async function generateDigest(body: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(body);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const base64Hash = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
  return `SHA-256=${base64Hash}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get("DOKU_CLIENT_ID");
    const secretKey = Deno.env.get("DOKU_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!clientId || !secretKey) {
      throw new Error("DOKU credentials not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const body: CheckoutRequest = await req.json();
    const { purchaseId, amount, description, customerName, customerEmail, customerPhone, items } = body;

    if (!purchaseId || !amount || !customerEmail) {
      throw new Error("Missing required fields: purchaseId, amount, customerEmail");
    }

    const invoiceNumber = `INV-${Date.now()}-${purchaseId.slice(0, 8)}`;
    
    // Get the host for callback URLs
    const origin = req.headers.get("origin") || "https://hkgscohedqgxrhmbryww.lovable.app";
    
    const requestBody = {
      order: {
        amount: Math.round(amount),
        invoice_number: invoiceNumber,
        currency: "IDR",
        callback_url: `${origin}/order-confirmation?id=${purchaseId}`,
        callback_url_cancel: `${origin}/?cancelled=true`,
        line_items: items?.map(item => ({
          name: item.name,
          price: Math.round(item.price),
          quantity: item.quantity
        })) || [{
          name: description || "Hookah Order",
          price: Math.round(amount),
          quantity: 1
        }]
      },
      customer: {
        id: purchaseId.slice(0, 20),
        name: customerName || "Guest",
        email: customerEmail,
        phone: customerPhone || "",
        country: "ID"
      },
      payment: {
        payment_due_date: 60 // 60 minutes
      }
    };

    const requestBodyStr = JSON.stringify(requestBody);
    const requestId = generateRequestId();
    const requestTimestamp = new Date().toISOString();
    const requestTarget = "/checkout/v1/payment";
    
    const digest = await generateDigest(requestBodyStr);
    const signature = await generateSignature(
      clientId,
      requestId,
      requestTimestamp,
      requestTarget,
      digest,
      secretKey
    );

    console.log("Creating DOKU checkout for purchase:", purchaseId);
    
    // Use sandbox URL for testing, change to https://api.doku.com for production
    const dokuUrl = "https://api-sandbox.doku.com/checkout/v1/payment";
    
    const response = await fetch(dokuUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Id": clientId,
        "Request-Id": requestId,
        "Request-Timestamp": requestTimestamp,
        "Signature": signature,
      },
      body: requestBodyStr,
    });

    const responseData = await response.json();
    console.log("DOKU response:", JSON.stringify(responseData));

    if (!response.ok) {
      throw new Error(`DOKU API error: ${JSON.stringify(responseData)}`);
    }

    // Extract payment URL from response
    const paymentUrl = responseData.response?.payment?.url;
    const tokenId = responseData.response?.payment?.token_id;

    if (!paymentUrl) {
      throw new Error("No payment URL in DOKU response");
    }

    // Update purchase with DOKU info
    const { error: updateError } = await supabase
      .from("purchases")
      .update({
        xendit_invoice_id: tokenId || invoiceNumber, // Reusing column for DOKU token
        xendit_invoice_url: paymentUrl, // Reusing column for DOKU URL
        notes: `DOKU Invoice: ${invoiceNumber}`
      })
      .eq("id", purchaseId);

    if (updateError) {
      console.error("Error updating purchase:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        invoiceId: tokenId || invoiceNumber,
        invoiceUrl: paymentUrl,
        invoiceNumber: invoiceNumber
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error creating DOKU checkout:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create checkout";
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
