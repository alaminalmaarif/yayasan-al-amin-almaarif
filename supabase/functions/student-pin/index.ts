import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

const UNITS = new Set(['KB','RA','TPQ','MDT','Pesantren','MTs','MA']);
const YEAR_RE = /^\d{4}\/\d{4}$/;
const PIN_RE = /^\d{4,6}$/;

function serviceClient(){
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}
function clean(v: unknown){ return String(v ?? '').trim(); }
function validContext(b:any){
  return YEAR_RE.test(clean(b.year)) && UNITS.has(clean(b.unit)) && clean(b.student_id) && clean(b.student_name);
}
async function hashToken(token:string){
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function studentExists(sb:any,b:any){
  const {data,error}=await sb.from('finance_students').select('id,student_name').eq('id',clean(b.student_id)).eq('academic_year',clean(b.year)).eq('unit',clean(b.unit)).maybeSingle();
  if(error) throw error;
  return !!data && data.student_name === clean(b.student_name);
}
async function createSession(sb:any,b:any){
  const token = crypto.randomUUID() + crypto.randomUUID();
  const tokenHash = await hashToken(token);
  const expires = new Date(Date.now()+2*60*60*1000).toISOString();
  const {error}=await sb.from('finance_pin_sessions').insert({token_hash:tokenHash,student_id:clean(b.student_id),student_name:clean(b.student_name),unit:clean(b.unit),expires_at:expires});
  if(error) throw error;
  return {token,expires_at:expires};
}
async function validSession(sb:any,token:string,b:any){
  if(!token) return null;
  const tokenHash=await hashToken(token);
  const {data,error}=await sb.from('finance_pin_sessions').select('*').eq('token_hash',tokenHash).gt('expires_at',new Date().toISOString()).maybeSingle();
  if(error) throw error;
  if(!data) return null;
  if(data.unit!==clean(b.unit)||data.student_name!==clean(b.student_name)) return null;
  return data;
}
function monthIndex(name:string){
  return ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'].indexOf(name);
}
function monthYearLabel(month:string,startYear:number){
  const idx=monthIndex(month); if(idx<0) return month;
  return `${month} ${idx>=6?startYear:startYear+1}`;
}
function report(transactions:any[],startYear:number){
  const accepted=transactions.filter(x=>x.verification_status==='accepted');
  const deductionSource=(x:any)=>{
    const raw=String(x.deduction_source||'').trim();
    if(raw==='mandatory'||raw==='voluntary'||raw==='none')return raw;
    return x.deduct_mandatory===true?'mandatory':'none';
  };
  const balance=(type:string)=>accepted.filter(x=>x.payment_type===type).reduce((n,x)=>n+Number(x.amount||0),0);
  const mandatory=balance('Tabungan Wajib')-accepted.filter(x=>deductionSource(x)==='mandatory').reduce((n,x)=>n+Number(x.amount||0),0);
  const sukarela=balance('Tabungan Sukarela')-accepted.filter(x=>deductionSource(x)==='voluntary').reduce((n,x)=>n+Number(x.amount||0),0);

  // Semua transaksi SPP yang sudah diterima ditampilkan, termasuk Cicil.
  // Jangan membatasi berdasarkan bulan berjalan karena wali murid dapat membayar
  // SPP bulan-bulan mendatang sekaligus.
  const spp=accepted.filter(x=>x.payment_type==='SPP' && ['Lunas','Cicil','Lunasi Cicilan'].includes(String(x.payment_status||'')))
    .map(x=>({
      month:x.payment_month,
      label:monthYearLabel(String(x.payment_month||''),startYear),
      amount:Number(x.amount||0),
      payment_status:String(x.payment_status||'-'),
      deduction_source:deductionSource(x),
      created_at:x.created_at
    }));

  const kegiatan=accepted.filter(x=>x.payment_type==='Kegiatan' && String(x.activity||'').trim())
    .map(x=>({
      activity:x.activity,
      amount:Number(x.amount||0),
      payment_status:String(x.payment_status||'-'),
      deduction_source:deductionSource(x),
      deduct_mandatory:deductionSource(x)==='mandatory',
      description:x.verification_note||'',
      created_at:x.created_at
    }));

  const ppdb=accepted.filter(x=>x.payment_type==='PPDB')
    .map(x=>({
      amount:Number(x.amount||0),
      payment_status:String(x.payment_status||'-'),
      accepted_at:x.verified_at || x.created_at,
      created_at:x.created_at
    }));

  const infak=accepted.filter(x=>x.payment_type==='Infak'||x.payment_type==='Bantuan').reduce((n,x)=>n+Number(x.amount||0),0);
  return {
    mandatory_balance:mandatory,
    sukarela_balance:sukarela,
    spp_paid:spp,
    kegiatan,
    ppdb_paid:ppdb,
    ppdb_balance:ppdb.reduce((n,x)=>n+x.amount,0),
    infak_balance:infak
  };
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST') return json({error:'Method not allowed'},405);
  try{
    const b=await req.json(); const action=clean(b.action); const sb=serviceClient();
    if(action==='check'){
      if(!validContext(b)) return json({error:'Data anak tidak valid.'},400);
      if(!(await studentExists(sb,b))) return json({error:'Nama anak tidak ditemukan pada tahun ajaran dan unit yang dipilih.'},404);
      const {data,error}=await sb.from('finance_student_pins').select('id').eq('unit',clean(b.unit)).eq('student_name',clean(b.student_name)).maybeSingle();
      if(error) throw error;
      return json({has_pin:!!data});
    }
    if(action==='create'){
      if(!validContext(b)||!PIN_RE.test(clean(b.pin))) return json({error:'PIN harus terdiri dari 4–6 digit angka.'},400);
      if(clean(b.pin)!==clean(b.pin_confirm)) return json({error:'Konfirmasi PIN tidak sama.'},400);
      if(!(await studentExists(sb,b))) return json({error:'Nama anak tidak ditemukan pada tahun ajaran dan unit yang dipilih.'},404);
      const {data:existing,error:findError}=await sb.from('finance_student_pins').select('id').eq('unit',clean(b.unit)).eq('student_name',clean(b.student_name)).maybeSingle();
      if(findError) throw findError;
      if(existing) return json({error:'Anak ini sudah memiliki PIN. Silakan masukkan PIN yang sudah ada.'},409);
      const {error}=await sb.from('finance_student_pins').insert({unit:clean(b.unit),student_name:clean(b.student_name),pin:clean(b.pin)});
      if(error) throw error;
      return json({ok:true,...await createSession(sb,b)});
    }
    if(action==='verify'){
      if(!validContext(b)||!PIN_RE.test(clean(b.pin))) return json({error:'PIN tidak valid.'},400);
      if(!(await studentExists(sb,b))) return json({error:'Nama anak tidak ditemukan pada tahun ajaran dan unit yang dipilih.'},404);
      const {data,error}=await sb.from('finance_student_pins').select('pin').eq('unit',clean(b.unit)).eq('student_name',clean(b.student_name)).maybeSingle();
      if(error) throw error;
      if(!data) return json({error:'Anak ini belum memiliki PIN. Silakan buat PIN terlebih dahulu.'},409);
      if(data.pin!==clean(b.pin)) return json({error:'PIN salah.'},401);
      return json({ok:true,...await createSession(sb,b)});
    }
    if(action==='report'){
      if(!validContext(b)) return json({error:'Data anak tidak valid.'},400);
      const session=await validSession(sb,clean(b.session_token),b);
      if(!session) return json({error:'Sesi PIN sudah berakhir. Silakan verifikasi PIN lagi.'},401);
      const {data,error}=await sb.from('finance_transactions').select('student_id,student_name,payment_type,amount,payment_status,payment_month,activity,purpose,deduct_mandatory,deduction_source,verification_status,verification_note,created_at')
        .eq('academic_year',clean(b.year)).eq('unit',clean(b.unit)).eq('verification_status','accepted').order('created_at',{ascending:true});
      if(error) throw error;
      const tx=(data||[]).filter((x:any)=>x.student_id===clean(b.student_id)||(x.student_id==null&&x.student_name===clean(b.student_name)));
      const startYear=Number(clean(b.year).slice(0,4));
      return json({year:clean(b.year),unit:clean(b.unit),student_name:clean(b.student_name),report:report(tx,startYear)});
    }
    return json({error:'Aksi tidak dikenal.'},400);
  }catch(e){
    console.error(e);
    return json({error:'Operasi PIN gagal. Periksa konfigurasi Supabase.'},500);
  }
});
