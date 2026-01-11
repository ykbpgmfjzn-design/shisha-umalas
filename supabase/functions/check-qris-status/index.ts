import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StatusRequest {
  invoiceNumber: string;
  purchaseId: string;
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
  secretKey: string
): Promise<string> {
  // For GET requests without body, no Digest header
  const componentSignature = [
    `Client-Id:${clientId}`,
    `Request-Id:${requestId}`,
    `Request-Timestamp:${requestTimestamp}`,
    `Request-Target:${requestTarget}`
  ].join("\n");
  
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
    
    const body: StatusRequest = await req.json();
    const { invoiceNumber, purchaseId } = body;

    if (!invoiceNumber) {
      throw new Error("Missing required field: invoiceNumber");
    }

    const requestId = generateRequestId();
    const now = new Date();
    const requestTimestamp = now.toISOString().split('.')[0] + 'Z';
    const requestTarget = `/orders/v1/status/${invoiceNumber}`;
    
    const signature = await generateSignature(
      clientId,
      requestId,
      requestTimestamp,
      requestTarget,
      secretKey
    );

    console.log("Checking QRIS payment status for:", invoiceNumber);
    
    const dokuUrl = `https://api-sandbox.doku.com/orders/v1/status/${invoiceNumber}`;
    
    const response = await fetch(dokuUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Client-Id": clientId,
        "Request-Id": requestId,
        "Request-Timestamp": requestTimestamp,
        "Signature": signature,
      },
    });

    const responseData = await response.json();
    console.log("DOKU status response:", JSON.stringify(responseData));

    if (!response.ok) {
      throw new Error(`DOKU API error: ${JSON.stringify(responseData)}`);
    }

    const transactionStatus = responseData.transaction?.status;
    let paymentStatus = "pending";
    
    if (transactionStatus === "SUCCESS") {
      paymentStatus = "paid";
    } else if (transactionStatus === "FAILED" || transactionStatus === "EXPIRED") {
      paymentStatus = "failed";
    }

    // Update purchase if status changed
    if (purchaseId && (paymentStatus === "paid" || paymentStatus === "failed")) {
      const updateData: Record<string, unknown> = {
        payment_status: paymentStatus,
      };
      
      if (paymentStatus === "paid") {
        updateData.paid_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from("purchases")
        .update(updateData)
        .eq("id", purchaseId);

      if (updateError) {
        console.error("Error updating purchase:", updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: paymentStatus,
        transactionStatus,
        rawResponse: responseData
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error checking QRIS status:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to check payment status";
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
