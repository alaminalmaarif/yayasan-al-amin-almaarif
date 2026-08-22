import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

const MIDTRANS_SANDBOX = 'https://app.sandbox.midtrans.com/snap/v1/transactions';
const MIDTRANS_PRODUCTION = 'https://app.midtrans.com/snap/v1/transactions';
const allowedUnits = new Set(['KB','RA','TPQ','MDT','Pesantren','Majelis Taklim','MTs','MA']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY');
  const clientKey = Deno.env.get('MIDTRANS_CLIENT_KEY');
  const env = (Deno.env.get('MIDTRANS_ENV') || 'sandbox').toLowerCase();
  if (!serverKey || !clientKey) return json({ error: 'Payment gateway belum dikonfigurasi.' }, 503);
  if (env !== 'sandbox' && env !== 'production') return json({ error: 'MIDTRANS_ENV harus bernilai sandbox atau production.' }, 503);
  if (!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) return json({ error: 'Layanan pembayaran belum dikonfigurasi.' }, 503);

  try {
    const body = await req.json();
    const studentName = String(body.student_name || '').trim();
    const unit = String(body.unit || '').trim();
    const paymentStatus = String(body.payment_status || '').trim();
    const description = String(body.description || '').trim().slice(0, 250);
    const amount = Math.round(Number(body.amount));
    if (!studentName || !allowedUnits.has(unit) || !['lunas','cicil'].includes(paymentStatus) || !Number.isFinite(amount) || amount < 1000) {
      return json({ error: 'Data pembayaran tidak lengkap atau tidak valid.' }, 400);
    }

    const orderId = `ALAMIN-${new Date().toISOString().replace(/\D/g,'').slice(0,14)}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const insert = await supabase.from('payments').insert({
      order_id: orderId, student_name: studentName, unit, payment_status: paymentStatus,
      amount, description, gateway: 'midtrans', gateway_status: 'pending'
    }).select('id,order_id').single();
    if (insert.error) throw insert.error;

    const endpoint = env === 'production' ? MIDTRANS_PRODUCTION : MIDTRANS_SANDBOX;
    const auth = btoa(`${serverKey}:`);
    const midtrans = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: amount },
        item_details: [{ id: paymentStatus, price: amount, quantity: 1, name: (description || `Pembayaran ${paymentStatus} - ${unit}`).slice(0, 50) }],
        customer_details: { first_name: studentName },
      })
    });
    const result = await midtrans.json();
    if (!midtrans.ok || !result.token) {
      await supabase.from('payments').update({ gateway_status: 'error', raw_response: result, updated_at: new Date().toISOString() }).eq('order_id', orderId);
      return json({ error: result.status_message || 'Payment gateway menolak transaksi.' }, 502);
    }
    await supabase.from('payments').update({ snap_token: result.token, raw_response: result, updated_at: new Date().toISOString() }).eq('order_id', orderId);
    return json({ order_id: orderId, token: result.token, client_key: clientKey, environment: env });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : 'Gagal membuat pembayaran.' }, 500);
  }
});
