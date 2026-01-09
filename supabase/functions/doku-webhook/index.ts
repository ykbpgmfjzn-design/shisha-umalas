import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, client-id, request-id, request-timestamp, signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log("DOKU webhook received:", JSON.stringify(payload));

    // DOKU sends different notification types
    const {
      transaction,
      order,
      channel,
      acquirer
    } = payload;

    const invoiceNumber = order?.invoice_number || transaction?.original_request_id;
    const status = transaction?.status;
    const amount = order?.amount || transaction?.amount;

    if (!invoiceNumber) {
      console.log("No invoice number in webhook payload");
      return new Response(
        JSON.stringify({ message: "OK - No invoice number" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing DOKU notification for invoice: ${invoiceNumber}, status: ${status}`);

    // Determine payment status
    let paymentStatus = "pending";
    if (status === "SUCCESS" || status === "PAID") {
      paymentStatus = "paid";
    } else if (status === "FAILED" || status === "EXPIRED" || status === "CANCELLED") {
      paymentStatus = "failed";
    }

    // Find and update purchase by invoice number in notes or xendit_invoice_id
    const { data: purchases, error: findError } = await supabase
      .from("purchases")
      .select("id")
      .or(`xendit_invoice_id.eq.${invoiceNumber},notes.ilike.%${invoiceNumber}%`)
      .limit(1);

    if (findError) {
      console.error("Error finding purchase:", findError);
      throw findError;
    }

    if (purchases && purchases.length > 0) {
      const purchaseId = purchases[0].id;
      
      const updateData: Record<string, unknown> = {
        payment_status: paymentStatus,
      };

      if (paymentStatus === "paid") {
        updateData.paid_at = new Date().toISOString();
      }

      // Add payment details to notes
      const noteDetails = [
        `Status: ${status}`,
        channel?.id ? `Channel: ${channel.id}` : null,
        acquirer?.id ? `Acquirer: ${acquirer.id}` : null,
        amount ? `Amount: ${amount}` : null
      ].filter(Boolean).join(", ");
      
      updateData.notes = `DOKU Invoice: ${invoiceNumber} | ${noteDetails}`;

      const { error: updateError } = await supabase
        .from("purchases")
        .update(updateData)
        .eq("id", purchaseId);

      if (updateError) {
        console.error("Error updating purchase:", updateError);
        throw updateError;
      }

      console.log(`Updated purchase ${purchaseId} to status: ${paymentStatus}`);
    } else {
      console.log(`No purchase found for invoice: ${invoiceNumber}`);
    }

    return new Response(
      JSON.stringify({ message: "OK" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("DOKU webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
