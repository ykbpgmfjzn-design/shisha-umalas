import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QrisRequest {
  purchaseId: string;
  amount: number;
  description: string;
  customerName: string;
  customerEmail: string;
}

function generateRequestId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function generateDigest(body: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(body);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const base64Hash = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
  return base64Hash;
}

async function generateSignature(
  clientId: string,
  requestId: string,
  requestTimestamp: string,
  requestTarget: string,
  digestValue: string,
  secretKey: string
): Promise<string> {
  const componentSignature = [
    `Client-Id:${clientId}`,
    `Request-Id:${requestId}`,
    `Request-Timestamp:${requestTimestamp}`,
    `Request-Target:${requestTarget}`,
    `Digest:${digestValue}`
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
    
    const body: QrisRequest = await req.json();
    const { purchaseId, amount, description, customerName, customerEmail } = body;

    if (!purchaseId || !amount || !customerEmail) {
      throw new Error("Missing required fields: purchaseId, amount, customerEmail");
    }

    const invoiceNumber = `QRIS-${Date.now()}-${purchaseId.slice(0, 8)}`;
    
    // QRIS expires in 30 minutes
    const expiryDate = new Date(Date.now() + 30 * 60 * 1000);
    const expiryDateStr = expiryDate.toISOString().split('.')[0] + 'Z';

    const requestBody = {
      order: {
        amount: Math.round(amount),
        invoice_number: invoiceNumber,
        currency: "IDR"
      },
      payment: {
        payment_due_date: 30 // 30 minutes
      },
      customer: {
        id: purchaseId.slice(0, 20),
        name: customerName || "Guest",
        email: customerEmail
      },
      qris: {
        type: "DYNAMIC"
      }
    };

    const requestBodyStr = JSON.stringify(requestBody);
    const requestId = generateRequestId();
    const now = new Date();
    const requestTimestamp = now.toISOString().split('.')[0] + 'Z';
    const requestTarget = "/qris/v1/direct";
    
    const digestBase64 = await generateDigest(requestBodyStr);
    const signature = await generateSignature(
      clientId,
      requestId,
      requestTimestamp,
      requestTarget,
      digestBase64,
      secretKey
    );

    console.log("Creating DOKU QRIS payment for purchase:", purchaseId);
    console.log("Amount:", amount);
    console.log("Invoice:", invoiceNumber);
    
    // Use sandbox for testing, production for live
    const dokuUrl = "https://api.doku.com/qris/v1/direct";
    
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
    console.log("DOKU QRIS response:", JSON.stringify(responseData));

    if (!response.ok) {
      throw new Error(`DOKU API error: ${JSON.stringify(responseData)}`);
    }

    // Extract QR code data from response
    const qrContent = responseData.qris?.qr_content;
    
    if (!qrContent) {
      throw new Error("No QR content in DOKU response");
    }

    // Update purchase with QRIS info
    const { error: updateError } = await supabase
      .from("purchases")
      .update({
        xendit_invoice_id: invoiceNumber,
        notes: `QRIS Payment: ${invoiceNumber}`,
        payment_status: "pending"
      })
      .eq("id", purchaseId);

    if (updateError) {
      console.error("Error updating purchase:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        invoiceNumber,
        qrContent,
        expiresAt: expiryDateStr,
        amount: Math.round(amount)
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error creating QRIS payment:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create QRIS payment";
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
