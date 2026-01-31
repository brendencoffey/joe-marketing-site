import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 1x1 transparent PNG
const TRACKING_PIXEL = Uint8Array.from(atob(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
), c => c.charCodeAt(0));

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const trackingId = url.searchParams.get("t");
    
    if (!trackingId) {
      return new Response(TRACKING_PIXEL, {
        headers: { "Content-Type": "image/png", ...corsHeaders }
      });
    }

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get client info
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Record the email open
    await supabase.from("email_opens").insert({
      tracking_id: trackingId,
      ip_address: ipAddress,
      user_agent: userAgent
    });

    // Update the activity with first open time
    const { data: activity } = await supabase
      .from("activities")
      .select("id, email_opened_at")
      .eq("email_tracking_id", trackingId)
      .single();

    if (activity && !activity.email_opened_at) {
      await supabase
        .from("activities")
        .update({ email_opened_at: new Date().toISOString() })
        .eq("email_tracking_id", trackingId);
      
      // Also send Slack notification for first open
      const { data: activityFull } = await supabase
        .from("activities")
        .select("*, deals(name, shops(name)), contacts(first_name, last_name, email)")
        .eq("id", activity.id)
        .single();
      
      if (activityFull) {
        const shopName = activityFull.deals?.shops?.name || "Unknown";
        const contactName = `${activityFull.contacts?.first_name || ""} ${activityFull.contacts?.last_name || ""}`.trim() || activityFull.contacts?.email;
        
        // Optional: Send Slack notification
        const slackWebhook = Deno.env.get("SLACK_WEBHOOK_URL");
        if (slackWebhook) {
          await fetch(slackWebhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: `👁️ *Email Opened*\n${contactName} at *${shopName}* opened your email`
            })
          });
        }
      }
    }

    // Return tracking pixel
    return new Response(TRACKING_PIXEL, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error("Error:", error);
    // Still return pixel even on error
    return new Response(TRACKING_PIXEL, {
      headers: { "Content-Type": "image/png", ...corsHeaders }
    });
  }
});
