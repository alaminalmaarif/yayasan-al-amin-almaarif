import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

async function getUser(req: Request) {
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data } = await sb.auth.getUser(auth.slice(7));
  return data.user || null;
}
Deno.serve(async req => {
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  if(req.method!=='GET') return json({error:'Method not allowed'},405);
  try {
    const user=await getUser(req); if(!user) return json({error:'Login diperlukan.'},401);
    const adminEmails=(Deno.env.get('ADMIN_EMAILS')||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
    if(!adminEmails.length) return json({error:'ADMIN_EMAILS belum dikonfigurasi.'},503);
    if(!adminEmails.includes(String(user.email||'').toLowerCase())) return json({error:'Tidak memiliki akses rekap pembayaran.'},403);
    const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const {data,error}=await sb.from('payments').select('order_id,student_name,unit,payment_status,amount,description,gateway_status,payment_type,paid_at,created_at').order('created_at',{ascending:false}).limit(5000);
    if(error) throw error; return json({rows:data||[]});
  }catch(e){return json({error:e instanceof Error?e.message:'Gagal memuat rekap.'},500)}
});
