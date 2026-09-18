// @ts-nocheck
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
function addCorsHeaders(response) {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([name, value])=>headers.set(name, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
// توحيد CORS هنا يمنع نسيان ترويسات OPTIONS أو أحد فروع الخطأ في دوال Edge.
export function serveWithCors(handler) {
  return Deno.serve(async (request)=>{
    if (request.method === "OPTIONS") {
      return new Response("ok", {
        status: 200,
        headers: corsHeaders
      });
    }
    try {
      return addCorsHeaders(await handler(request));
    } catch (error) {
      console.error("Unhandled Edge Function error:", error);
      return new Response(JSON.stringify({
        error: "Internal server error"
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
  });
}
