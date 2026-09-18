import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in environment');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  try {
    const email = `dev+tester+${Date.now()}@example.com`;
    const password = 'Pass1234!';
    console.log('Signing up test user:', email);
    const { data: signData, error: signError } = await supabase.auth.signUp({ email, password });
    if (signError) {
      console.error('signUp error:', signError.message || signError);
    } else {
      console.log('signUp result:', signData);
    }

    // Try to sign in (some Supabase projects require confirm; this will show outcome)
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      console.error('signIn error:', signInError.message || signInError);
    } else {
      console.log('signIn success, session exists:', !!signInData.session);
    }

    const user = signInData?.user ?? signData?.user;
    if (!user) {
      console.error('No authenticated user available - cannot insert row under RLS policies.');
      process.exit(1);
    }

    console.log('Attempting to insert test property as user', user.id);
    const { data: insertData, error: insertError } = await supabase.from('properties').insert([
      {
        seller_id: user.id,
        purpose: 'sale',
        type: 'شقة',
        title: 'إعلان اختبار',
        short_title: 'اختبار',
        province: 'القاهرة',
        location: 'منطقة اختبار',
        price: 1000,
        area: 100,
        rooms: 1,
        baths: 1,
        reception: 1,
        features: [],
        description: 'وصف اختبار من السكربت',
        media: [],
        music: null,
      },
    ]).select().single();

    if (insertError) {
      console.error('Insert error:', insertError.message || insertError);
    } else {
      console.log('Insert success:', insertData);
    }
  } catch (e) {
    console.error('Unexpected error:', e);
  }
}

run();
