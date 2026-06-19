import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://amdhbxowpnpwhtxxayuj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZGhieG93cG5wd2h0eHhheXVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNzQ0NzIsImV4cCI6MjA4Nzg1MDQ3Mn0.SW4U3CS-GrChptrtKyZnKy5x-wiIaNIXHULPGO56DFo';

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, saweria-callback-signature');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const signatureHeader = req.headers['saweria-callback-signature'];
  if (!signatureHeader) {
    return res.status(401).json({ error: 'Missing saweria-callback-signature header' });
  }

  const payload = req.body;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Invalid payload body' });
  }

  const { version, id, amount_raw, donator_name, donator_email, message } = payload;

  // Use configured environment stream key or default fallback
  const streamKey = process.env.SAWERIA_STREAM_KEY || '404af2c94a1776c1acb47060b881adf4';
  
  // Concatenate message parameters: {version}{id}{amount_raw}{donator_name}{donator_email}
  const computedMessage = `${version || ''}${id || ''}${amount_raw || 0}${donator_name || ''}${donator_email || ''}`;

  const computedSignature = crypto
    .createHmac('sha256', streamKey)
    .update(computedMessage)
    .digest('hex');

  if (computedSignature !== signatureHeader) {
    console.error('[Saweria Webhook] Signature verification failed.');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  try {
    // Write the transaction record into Supabase
    const { error } = await supabase
      .from('ykn_donations')
      .insert({
        saweria_id: id,
        donator_name: donator_name || 'Anonymous',
        amount: Number(amount_raw) || 0,
        message: message || '',
        created_at: payload.created_at || new Date().toISOString()
      });

    if (error) {
      // Code 23505: Unique constraint violation (duplicate webhook send)
      if (error.code === '23505') {
        console.log(`[Saweria Webhook] Donation ID ${id} already exists, skipping.`);
        return res.status(200).json({ success: true, message: 'Duplicate skipped' });
      }
      throw error;
    }

    console.log(`[Saweria Webhook] Donation saved: ${donator_name} - Rp ${amount_raw}`);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[Saweria Webhook] Database insert error:', err.message);
    return res.status(500).json({ error: 'Internal database error' });
  }
}
