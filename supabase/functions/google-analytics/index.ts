import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GAReport {
  dailyVisits: { date: string; visits: number }[];
  weeklyTotal: number;
  monthlyTotal: number;
  trafficSources: { source: string; visits: number; percentage: number }[];
  todayVisits: number;
}

// Create JWT for Google Service Account
async function createJWT(clientEmail: string, privateKey: string): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key - handle various formats from env variables
  // The key might come with escaped \\n, literal \n, or actual newlines
  let cleanedKey = privateKey;
  
  // Remove surrounding quotes if present (from JSON copy-paste)
  cleanedKey = cleanedKey.replace(/^["']|["']$/g, '');
  
  // First, handle double-escaped newlines (\\n -> \n)
  cleanedKey = cleanedKey.replace(/\\\\n/g, '\n');
  // Then handle single-escaped newlines (\n as string -> actual newline)
  cleanedKey = cleanedKey.replace(/\\n/g, '\n');
  
  // Remove PEM headers/footers
  cleanedKey = cleanedKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/-----BEGIN RSA PRIVATE KEY-----/g, '')
    .replace(/-----END RSA PRIVATE KEY-----/g, '');
  
  // Remove all whitespace, newlines, carriage returns, and any remaining quotes
  cleanedKey = cleanedKey.replace(/[\n\r\s"']/g, '');
  
  // Log key length for debugging (not the actual key!)
  console.log(`Private key base64 length after cleaning: ${cleanedKey.length}`);
  
  if (cleanedKey.length === 0) {
    throw new Error("Private key is empty after cleaning. Check GA_PRIVATE_KEY format.");
  }
  
  // Validate base64 characters
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(cleanedKey)) {
    // Try to find invalid characters
    const invalidChars = cleanedKey.match(/[^A-Za-z0-9+/=]/g);
    throw new Error(`Private key contains invalid base64 characters: ${invalidChars?.slice(0, 5).join(', ')}`);
  }
  
  let binaryKey: Uint8Array;
  try {
    const decoded = atob(cleanedKey);
    binaryKey = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      binaryKey[i] = decoded.charCodeAt(i);
    }
  } catch (e) {
    throw new Error(`Failed to decode private key base64. Length: ${cleanedKey.length}. Error: ${e}`);
  }
  
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey.buffer as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return `${unsignedToken}.${signatureB64}`;
}

// Get access token from Google
async function getAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const jwt = await createJWT(clientEmail, privateKey);
  
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to get access token: ${JSON.stringify(data)}`);
  }
  
  return data.access_token;
}

// Run GA4 report
async function runReport(
  accessToken: string,
  propertyId: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
  metrics: string[]
): Promise<any> {
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: dimensions.map(name => ({ name })),
        metrics: metrics.map(name => ({ name })),
      }),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`GA Report failed: ${JSON.stringify(data)}`);
  }
  
  return data;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const propertyId = Deno.env.get("GA_PROPERTY_ID");
    const clientEmail = Deno.env.get("GA_CLIENT_EMAIL");
    const privateKey = Deno.env.get("GA_PRIVATE_KEY");

    if (!propertyId || !clientEmail || !privateKey) {
      throw new Error("Missing Google Analytics credentials");
    }

    // Get access token
    const accessToken = await getAccessToken(clientEmail, privateKey.replace(/\\n/g, '\n'));

    // Get daily visits for last 7 days
    const dailyReport = await runReport(
      accessToken,
      propertyId,
      "7daysAgo",
      "today",
      ["date"],
      ["sessions"]
    );

    // Get monthly total
    const monthlyReport = await runReport(
      accessToken,
      propertyId,
      "30daysAgo",
      "today",
      [],
      ["sessions"]
    );

    // Get traffic sources
    const sourcesReport = await runReport(
      accessToken,
      propertyId,
      "30daysAgo",
      "today",
      ["sessionSource"],
      ["sessions"]
    );

    // Get today's visits
    const todayReport = await runReport(
      accessToken,
      propertyId,
      "today",
      "today",
      [],
      ["sessions"]
    );

    // Parse daily visits
    const dailyVisits = (dailyReport.rows || []).map((row: any) => ({
      date: row.dimensionValues[0].value,
      visits: parseInt(row.metricValues[0].value, 10),
    })).sort((a: any, b: any) => a.date.localeCompare(b.date));

    // Calculate weekly total from daily data
    const weeklyTotal = dailyVisits.reduce((sum: number, day: any) => sum + day.visits, 0);

    // Monthly total
    const monthlyTotal = monthlyReport.rows?.[0]?.metricValues?.[0]?.value
      ? parseInt(monthlyReport.rows[0].metricValues[0].value, 10)
      : 0;

    // Today's visits
    const todayVisits = todayReport.rows?.[0]?.metricValues?.[0]?.value
      ? parseInt(todayReport.rows[0].metricValues[0].value, 10)
      : 0;

    // Traffic sources with percentages
    const totalSourceVisits = (sourcesReport.rows || []).reduce(
      (sum: number, row: any) => sum + parseInt(row.metricValues[0].value, 10),
      0
    );

    const trafficSources = (sourcesReport.rows || [])
      .map((row: any) => {
        const visits = parseInt(row.metricValues[0].value, 10);
        return {
          source: row.dimensionValues[0].value || "Direct",
          visits,
          percentage: totalSourceVisits > 0 ? Math.round((visits / totalSourceVisits) * 100) : 0,
        };
      })
      .sort((a: any, b: any) => b.visits - a.visits)
      .slice(0, 10);

    const report: GAReport = {
      dailyVisits,
      weeklyTotal,
      monthlyTotal,
      trafficSources,
      todayVisits,
    };

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Google Analytics error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
