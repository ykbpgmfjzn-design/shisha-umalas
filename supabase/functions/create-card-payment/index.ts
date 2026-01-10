import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CardPaymentRequest {
  purchaseId: string;
  amount: number;
  description: string;
  customerName: string;
  customerEmail: string;
  cardNumber: string;
  cardExpMonth: string;
  cardExpYear: string;
  cardCvv: string;
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
    
    const body: CardPaymentRequest = await req.json();
    const { 
      purchaseId, 
      amount, 
      description, 
      customerName, 
      customerEmail,
      cardNumber,
      cardExpMonth,
      cardExpYear,
      cardCvv
    } = body;

    if (!purchaseId || !amount || !customerEmail) {
      throw new Error("Missing required fields: purchaseId, amount, customerEmail");
    }

    if (!cardNumber || !cardExpMonth || !cardExpYear || !cardCvv) {
      throw new Error("Missing card details");
    }

    const invoiceNumber = `CARD-${Date.now()}-${purchaseId.slice(0, 8)}`;

    // Step 1: Tokenize the card
    const tokenRequestBody = {
      card: {
        number: cardNumber.replace(/\s/g, ''),
        exp_month: cardExpMonth.padStart(2, '0'),
        exp_year: cardExpYear.length === 2 ? `20${cardExpYear}` : cardExpYear,
        cvv: cardCvv
      }
    };

    const tokenRequestBodyStr = JSON.stringify(tokenRequestBody);
    const tokenRequestId = generateRequestId();
    const tokenNow = new Date();
    const tokenTimestamp = tokenNow.toISOString().split('.')[0] + 'Z';
    const tokenTarget = "/credit-card/v1/token";
    
    const tokenDigest = await generateDigest(tokenRequestBodyStr);
    const tokenSignature = await generateSignature(
      clientId,
      tokenRequestId,
      tokenTimestamp,
      tokenTarget,
      tokenDigest,
      secretKey
    );

    console.log("Creating card token for purchase:", purchaseId);
    
    const tokenResponse = await fetch("https://api.doku.com/credit-card/v1/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Id": clientId,
        "Request-Id": tokenRequestId,
        "Request-Timestamp": tokenTimestamp,
        "Signature": tokenSignature,
      },
      body: tokenRequestBodyStr,
    });

    const tokenData = await tokenResponse.json();
    console.log("Token response:", JSON.stringify(tokenData));

    if (!tokenResponse.ok || !tokenData.token?.id) {
      throw new Error(tokenData.error?.message || "Failed to tokenize card");
    }

    const tokenId = tokenData.token.id;

    // Step 2: Charge the card
    const chargeRequestBody = {
      order: {
        amount: Math.round(amount),
        invoice_number: invoiceNumber,
        currency: "IDR"
      },
      payment: {
        token_id: tokenId,
        type: "AUTHORIZE_CAPTURE"
      },
      customer: {
        id: purchaseId.slice(0, 20),
        name: customerName || "Guest",
        email: customerEmail
      }
    };

    const chargeRequestBodyStr = JSON.stringify(chargeRequestBody);
    const chargeRequestId = generateRequestId();
    const chargeNow = new Date();
    const chargeTimestamp = chargeNow.toISOString().split('.')[0] + 'Z';
    const chargeTarget = "/credit-card/v1/payment/host-to-host";
    
    const chargeDigest = await generateDigest(chargeRequestBodyStr);
    const chargeSignature = await generateSignature(
      clientId,
      chargeRequestId,
      chargeTimestamp,
      chargeTarget,
      chargeDigest,
      secretKey
    );

    console.log("Charging card for invoice:", invoiceNumber);
    
    const chargeResponse = await fetch("https://api.doku.com/credit-card/v1/payment/host-to-host", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Id": clientId,
        "Request-Id": chargeRequestId,
        "Request-Timestamp": chargeTimestamp,
        "Signature": chargeSignature,
      },
      body: chargeRequestBodyStr,
    });

    const chargeData = await chargeResponse.json();
    console.log("Charge response:", JSON.stringify(chargeData));

    // Check if 3DS is required
    if (chargeData.credit_card?.three_d_secure?.redirect_url) {
      // 3DS required - return the redirect URL
      const { error: updateError } = await supabase
        .from("purchases")
        .update({
          xendit_invoice_id: invoiceNumber,
          notes: `Card Payment (3DS pending): ${invoiceNumber}`,
          payment_status: "pending_3ds"
        })
        .eq("id", purchaseId);

      if (updateError) {
        console.error("Error updating purchase:", updateError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          requires3DS: true,
          redirectUrl: chargeData.credit_card.three_d_secure.redirect_url,
          invoiceNumber
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check payment status
    const paymentStatus = chargeData.credit_card?.status;
    
    if (paymentStatus === "SUCCESS" || chargeData.transaction?.status === "SUCCESS") {
      // Payment successful
      const { error: updateError } = await supabase
        .from("purchases")
        .update({
          xendit_invoice_id: invoiceNumber,
          notes: `Card Payment: ${invoiceNumber}`,
          payment_status: "paid",
          paid_at: new Date().toISOString()
        })
        .eq("id", purchaseId);

      if (updateError) {
        console.error("Error updating purchase:", updateError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          paid: true,
          invoiceNumber,
          message: "Payment successful"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Payment failed
    throw new Error(chargeData.error?.message || chargeData.credit_card?.bank_message || "Payment declined");

  } catch (error: unknown) {
    console.error("Error processing card payment:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to process card payment";
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
