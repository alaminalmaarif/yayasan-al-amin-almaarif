import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const units = new Set(['KB','RA','TPQ','MDT','Pesantren','Majelis Taklim','MTs','MA']);
const types = new Set(['Tabungan Wajib','Tabungan Sukarela','SPP','Kegiatan','PPDB','Infak','Bantuan']);
const statuses = new Set(['Lunas','Cicil','Lunasi Cicilan']);
const deductionSources = new Set(['none','mandatory','voluntary']);

function deductionSource(b:any){
  const raw=String(b.deduction_source||'').trim();
  if(raw==='mandatory'||raw==='voluntary'||raw==='none')return raw;
  return b.deduct_mandatory===true?'mandatory':'none';
}
function deductionSourceOf(x:any){
  const raw=String(x.deduction_source||'').trim();
  if(raw==='mandatory'||raw==='voluntary'||raw==='none')return raw;
  return x.deduct_mandatory===true?'mandatory':'none';
}
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {status, headers:{...corsHeaders,'Content-Type':'application/json'}});

async function savingsBalances(sb:any, b:any) {
  const {data,error}=await sb.from('finance_transactions')
    .select('student_id,student_name,payment_type,amount,deduct_mandatory,deduction_source')
    .eq('academic_year',b.academic_year).eq('unit',b.unit)
    .eq('verification_status','accepted');
  if(error) throw error;
  const rows=(data||[]).filter((x:any)=>x.student_id===b.student_id || (!x.student_id && x.student_name===b.student_name));
  const mandatory=rows.reduce((n:number,x:any)=>n+(x.payment_type==='Tabungan Wajib'?Number(x.amount):0)-(deductionSourceOf(x)==='mandatory'?Number(x.amount):0),0);
  const voluntary=rows.reduce((n:number,x:any)=>n+(x.payment_type==='Tabungan Sukarela'?Number(x.amount):0)-(deductionSourceOf(x)==='voluntary'?Number(x.amount):0),0);
  return {mandatory,voluntary};
}

Deno.serve(async req => {
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST') return json({error:'Method not allowed'},405);
  try {
    const b=await req.json();
    const year=String(b.academic_year||'').trim();
    const unit=String(b.unit||'').trim();
    const studentId=String(b.student_id||'').trim();
    const student=String(b.student_name||'').trim();
    const type=String(b.payment_type||'').trim();
    const amount=Number(b.amount);

    if(!studentId || !student || !/^\d{4}\/\d{4}$/.test(year) || !units.has(unit) || !types.has(type) || !Number.isFinite(amount) || amount<1000)
      return json({error:'Data pembayaran tidak lengkap atau tidak valid.'},400);

    if((type==='SPP'||type==='Kegiatan'||type==='PPDB') && !statuses.has(String(b.payment_status||'')))
      return json({error:'Status pembayaran tidak valid.'},400);

    if((type==='Tabungan Wajib'||type==='Tabungan Sukarela') && !/^\d{4}-\d{2}-\d{2}$/.test(String(b.payment_date||'')))
      return json({error:'Tanggal wajib diisi.'},400);

    if(type==='SPP' && !String(b.month||'').trim())
      return json({error:'Bulan SPP wajib diisi.'},400);

    if(type==='Kegiatan' && !String(b.activity||'').trim())
      return json({error:'Kegiatan wajib diisi.'},400);

    if(type==='Infak' && !String(b.purpose||'').trim())
      return json({error:'Peruntukan infak wajib diisi.'},400);

    if(type==='Kegiatan' && String(b.activity).length > 150)
      return json({error:'Nama kegiatan terlalu panjang.'},400);

    if(type==='Infak' && String(b.purpose).length > 150)
      return json({error:'Peruntukan infak terlalu panjang.'},400);

    const deduction = deductionSource(b);
    if(!deductionSources.has(deduction)) return json({error:'Sumber pemotongan tabungan tidak valid.'},400);
    if(deduction!=='none' && type!=='SPP' && type!=='Kegiatan' && type!=='Infak') return json({error:'Pemotongan tabungan hanya berlaku untuk SPP, Kegiatan, dan Infak.'},400);
    const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const pinToken=String(b.pin_session_token||'').trim();
    if(!pinToken) return json({error:'PIN Anak belum diverifikasi.'},401);
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(pinToken));
    const tokenHash=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
    const {data:pinSession,error:pinError}=await sb.from('finance_pin_sessions').select('student_id,student_name,unit').eq('token_hash',tokenHash).gt('expires_at',new Date().toISOString()).maybeSingle();
    if(pinError) throw pinError;
    if(!pinSession || pinSession.unit!==unit || pinSession.student_id!==studentId || pinSession.student_name!==student) return json({error:'PIN Anak belum diverifikasi atau sesi PIN sudah berakhir.'},401);

    const {data:studentRow,error:studentError}=await sb.from('finance_students').select('id')
      .eq('id',studentId).eq('academic_year',year).eq('unit',unit).maybeSingle();
    if(studentError) throw studentError;
    if(!studentRow) return json({error:'Nama siswa tidak ditemukan pada tahun ajaran dan unit yang dipilih.'},400);

    // Jalur QRIS (tidak dipotong tabungan) sengaja tidak membaca saldo tabungan.
    // Ini menjaga pembayaran biasa tetap kompatibel bila kolom baru belum termuat di schema cache.
    let balances:any = null;
    if(type==='Tabungan Wajib' || deduction!=='none') {
      balances=await savingsBalances(sb,{academic_year:year,unit,student_id:studentId,student_name:student});
    }
    if(type==='Tabungan Wajib' && balances.mandatory+amount>500000)
      return json({error:'Saldo Tabungan Wajib tidak boleh melebihi Rp500.000.'},400);
    if(deduction!=='none'){
      const balance=deduction==='mandatory'?balances.mandatory:balances.voluntary;
      const label=deduction==='mandatory'?'Tabungan Wajib':'Tabungan Sukarela';
      if(amount>balance) return json({error:`Saldo ${label} tidak mencukupi. Saldo saat ini Rp${balance.toLocaleString('id-ID')}.`},400);
    }

    const orderId=`QRIS-${Date.now()}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
    const requiresQris = deduction === 'none';
    const {error}=await sb.from('finance_transactions').insert({
      order_id:orderId,student_id:studentId,academic_year:year,unit,student_name:student,payment_type:type,amount,
      payment_status: type==='SPP'||type==='Kegiatan'||type==='PPDB' ? b.payment_status : null,
      payment_date:b.payment_date||null,payment_month:b.month||null,activity:b.activity||null,
      purpose:b.purpose||null,deduction_source:deduction,deduct_mandatory:deduction==='mandatory',
      // Semua pembayaran wali murid yang memotong tabungan masuk pending agar
      // admin dapat Terima/Tolak sebelum saldo dianggap terpakai.
      source:requiresQris?'qris':'tabungan',verification_status:'pending',
      verified_at:null
    });
    if(error) throw error;
    return json({success:true,order_id:orderId,requires_qris:requiresQris});
  } catch(e) {
    console.error(e);
    return json({error:'Gagal mencatat pembayaran.'},500);
  }
});
