export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders
  });
}