import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

const TYPES=['Tabungan Wajib','Tabungan Sukarela','SPP','Kegiatan','PPDB','Infak','Bantuan'];
const UNITS=new Set(['KB','RA','TPQ','MDT','Pesantren','MTs','MA']);
const STATUSES=new Set(['Lunas','Cicil','Lunasi Cicilan']);
const ACTIVITIES=new Set(['Maulid','Agustusan','Karyawisata','Manasik Haji','Renang','Lomba']);
const PURPOSES=new Set(['Pembangunan','Guru','Sarana & Prasarana','Operasional']);

async function admin(req:Request){
  const token=req.headers.get('authorization')?.replace(/^Bearer\s+/,'');
  if(!token)return null;
  const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const {data}=await sb.auth.getUser(token);
  const allowed=(Deno.env.get('ADMIN_EMAILS')||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  return data.user&&allowed.includes((data.user.email||'').toLowerCase())?sb:null;
}
function validYear(v:any){return /^\d{4}\/\d{4}$/.test(String(v||''))}
async function mandatoryBalance(sb:any,b:any){
  const {data,error}=await sb.from('finance_transactions').select('student_id,student_name,payment_type,amount,deduct_mandatory')
    .eq('academic_year',b.year).eq('unit',b.unit).eq('verification_status','accepted');
  if(error)throw error;
  return(data||[]).filter((x:any)=>x.student_id===b.student_id || (!x.student_id && x.student_name===b.student_name)).reduce((n:number,x:any)=>
    n+(x.payment_type==='Tabungan Wajib'?Number(x.amount):0)
      -(x.payment_type==='Kegiatan'&&x.deduct_mandatory?Number(x.amount):0),0);
}
async function studentExists(sb:any,b:any){
  const {data,error}=await sb.from('finance_students').select('id,student_name').eq('id',String(b.student_id||'')).eq('academic_year',b.year).eq('unit',b.unit).maybeSingle();
  if(error)throw error; return !!data;
}
function validateTransaction(b:any){
  const type=String(b.payment_type||'');
  const amount=Number(b.amount);
  if(!TYPES.includes(type)||!UNITS.has(String(b.unit||''))||!validYear(b.year)||!String(b.student_id||'').trim()||!String(b.student_name||'').trim()||!Number.isFinite(amount)||amount<1000)
    return 'Data transaksi tidak valid.';
  if((type==='SPP'||type==='Kegiatan'||type==='PPDB')&&!STATUSES.has(String(b.payment_status||''))) return 'Status pembayaran tidak valid.';
  if((type==='Tabungan Wajib'||type==='Tabungan Sukarela')&&!/^\d{4}-\d{2}-\d{2}$/.test(String(b.payment_date||''))) return 'Tanggal wajib diisi.';
  if(type==='SPP'&&!String(b.payment_month||'').trim()) return 'Bulan SPP wajib diisi.';
  if(type==='Kegiatan'&&!String(b.activity||'').trim()) return 'Kegiatan wajib diisi.';
  if(type==='Infak'&&!String(b.purpose||'').trim()) return 'Peruntukan infak wajib diisi.';
  if(type!=='Kegiatan'&&b.deduct_mandatory===true) return 'Potong Tabungan Wajib hanya berlaku untuk pembayaran Kegiatan.';
  if(type==='Kegiatan'&&b.activity!=='Isi Manual'&& !ACTIVITIES.has(String(b.activity))) return 'Kegiatan tidak valid.';
  if(type==='Infak'&&b.purpose!=='Isi Manual'&& !PURPOSES.has(String(b.purpose))) return 'Peruntukan infak tidak valid.';
  return null;
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  const sb=await admin(req);if(!sb)return json({error:'Akses admin diperlukan.'},403);
  try{
    const b=await req.json(),a=b.action;
    if(a==='students'){
      if(!validYear(b.year)||!UNITS.has(String(b.unit||'')))return json({error:'Tahun ajaran atau unit tidak valid.'},400);
      const {data,error}=await sb.from('finance_students').select('*').eq('academic_year',b.year).eq('unit',b.unit).order('student_name');
      if(error)throw error;
      const {data:pins,error:pinError}=await sb.from('finance_student_pins').select('student_name,pin').eq('unit',b.unit);
      if(pinError)throw pinError;
      const pinMap=new Map((pins||[]).map((x:any)=>[x.student_name,x.pin]));
      return json({rows:(data||[]).map((x:any)=>({...x,pin:pinMap.get(x.student_name)||null}))});
    }
    if(a==='add_student'){
      const name=String(b.student_name||'').trim();
      if(!validYear(b.year)||!UNITS.has(String(b.unit||''))||!name)return json({error:'Tahun ajaran, unit, dan nama siswa wajib diisi.'},400);
      const {data:row,error}=await sb.from('finance_students').insert({academic_year:b.year,unit:b.unit,student_name:name}).select('*').single();
      if(error){
        console.error('add_student error:',error);
        if(error.code==='23505')return json({error:'Siswa dengan nama yang sama sudah terdaftar pada tahun ajaran dan unit ini.'},409);
        return json({error:`Gagal menambah siswa: ${error.message||'periksa struktur tabel finance_students dan migration Supabase.'}`},500);
      }
      return json({success:true,row});
    }
    if(a==='transactions'){
      if(!validYear(b.year)||!UNITS.has(String(b.unit||'')))return json({error:'Tahun ajaran atau unit tidak valid.'},400);
      const {data,error}=await sb.from('finance_transactions').select('*').eq('academic_year',b.year).eq('unit',b.unit).order('created_at',{ascending:false});
      if(error)throw error;return json({rows:data});
    }
    if(a==='spp_arrears'){
      if(!validYear(b.year)||!UNITS.has(String(b.unit||'')))return json({error:'Tahun ajaran atau unit tidak valid.'},400);
      const startYear=Number(String(b.year).slice(0,4));
      const monthNames=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
      const academicMonths=[6,7,8,9,10,11,0,1,2,3,4,5];
      const now=new Date();
      const academicStart=new Date(Date.UTC(startYear,6,1));
      const academicEnd=new Date(Date.UTC(startYear+1,5,30,23,59,59));
      let dueCount=0;
      if(now>=academicEnd) dueCount=12;
      else if(now>=academicStart){ const pos=academicMonths.indexOf(now.getUTCMonth()); dueCount=pos<0?0:pos+1; }
      const dueMonths=academicMonths.slice(0,dueCount);
      const {data:students,error:studentError}=await sb.from('finance_students').select('id,student_name').eq('academic_year',b.year).eq('unit',b.unit).order('student_name');
      if(studentError)throw studentError;
      const {data:tx,error:txError}=await sb.from('finance_transactions').select('student_id,student_name,payment_type,payment_status,payment_month,verification_status').eq('academic_year',b.year).eq('unit',b.unit).eq('payment_type','SPP').eq('verification_status','accepted');
      if(txError)throw txError;
      const rows=(students||[]).map((st:any)=>{
        const paid=new Set((tx||[]).filter((x:any)=>(x.student_id===st.id||(x.student_id==null&&x.student_name===st.student_name))&&['Lunas','Lunasi Cicilan'].includes(String(x.payment_status||''))).map((x:any)=>monthNames.indexOf(String(x.payment_month||''))));
        const unpaid=dueMonths.filter(i=>!paid.has(i)).map(i=>{const y=i>=6?startYear:startYear+1;return `${monthNames[i]} ${y}`});
        return {student_id:st.id,student_name:st.student_name,unpaid_months:unpaid};
      }).filter((x:any)=>x.unpaid_months.length);
      return json({rows});
    }
    if(a==='expenses'){
      if(!validYear(b.year)||!UNITS.has(String(b.unit||'')))return json({error:'Tahun ajaran atau unit tidak valid.'},400);
      const {data,error}=await sb.from('finance_expenses').select('*').eq('academic_year',b.year).eq('unit',b.unit).order('created_at',{ascending:false});
      if(error)throw error;return json({rows:data});
    }
    if(a==='add_expense'){
      if(!validYear(b.year)||!UNITS.has(String(b.unit||'')))return json({error:'Tahun ajaran atau unit tidak valid.'},400);
      const amount=Number(b.amount),purpose=String(b.purpose||'').trim(),note=String(b.note||'').trim();
      if(!Number.isFinite(amount)||amount<1000)return json({error:'Nominal pengeluaran minimal Rp1.000.'},400);
      if(!purpose)return json({error:'Keperluan pengeluaran wajib diisi.'},400);
      const {data:row,error}=await sb.from('finance_expenses').insert({academic_year:b.year,unit:b.unit,amount,purpose,note:note||null}).select('*').single();
      if(error)throw error;return json({success:true,row});
    }
    if(a==='add_transaction'){
      const validation=validateTransaction(b);if(validation)return json({error:validation},400);
      if(!(await studentExists(sb,b)))return json({error:'Nama siswa tidak ditemukan pada tahun ajaran dan unit yang dipilih.'},400);
      const amount=Number(b.amount);
      const balance=await mandatoryBalance(sb,b);
      if(b.payment_type==='Tabungan Wajib'&&balance+amount>500000)return json({error:'Saldo Tabungan Wajib tidak boleh melebihi Rp500.000.'},400);
      if(b.payment_type==='Kegiatan'&&b.deduct_mandatory===true&&amount>balance)return json({error:`Saldo Tabungan Wajib tidak mencukupi. Saldo saat ini Rp${balance.toLocaleString('id-ID')}.`},400);
      const row={
        academic_year:b.year,unit:b.unit,student_id:String(b.student_id),student_name:String(b.student_name).trim(),payment_type:b.payment_type,amount,
        payment_status:b.payment_status||null,payment_date:b.payment_date||null,payment_month:b.payment_month||null,
        activity:b.activity||null,purpose:b.purpose||null,deduct_mandatory:b.payment_type==='Kegiatan'&&b.deduct_mandatory===true,
        source:'manual',verification_status:'accepted',verified_at:new Date().toISOString()
      };
      const {error}=await sb.from('finance_transactions').insert(row);if(error)throw error;return json({success:true});
    }
    if(a==='verify'){
      if(!['accepted','rejected'].includes(b.status))return json({error:'Status verifikasi tidak valid.'},400);
      if(b.status==='rejected'&&!String(b.note||'').trim())return json({error:'Keterangan penolakan wajib diisi.'},400);
      const {data:tx,error:findError}=await sb.from('finance_transactions').select('*').eq('id',b.id).eq('verification_status','pending').maybeSingle();
      if(findError)throw findError;if(!tx)return json({error:'Transaksi tidak ditemukan atau sudah diverifikasi.'},404);
      if(b.status==='accepted'&&tx.payment_type==='Kegiatan'&&tx.deduct_mandatory){
        const balance=await mandatoryBalance(sb,{year:tx.academic_year,unit:tx.unit,student_id:tx.student_id,student_name:tx.student_name});
        if(Number(tx.amount)>balance)return json({error:`Saldo Tabungan Wajib tidak mencukupi saat verifikasi. Saldo saat ini Rp${balance.toLocaleString('id-ID')}.`},400);
      }
      const {error}=await sb.from('finance_transactions').update({verification_status:b.status,verification_note:b.note||null,verified_at:new Date().toISOString()}).eq('id',b.id).eq('verification_status','pending');
      if(error)throw error;return json({success:true});
    }
    return json({error:'Aksi tidak dikenal.'},400);
  }catch(e){console.error(e);return json({error:'Operasi gagal. Periksa data dan konfigurasi Supabase.'},500);}
});
