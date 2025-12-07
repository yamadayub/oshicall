import { createClient } from '@supabase/supabase-js';

// Production Credentials
const SUPABASE_URL = 'https://atkhwwqunwmpzqkgavtx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0a2h3d3F1bndtcHpxa2dhdnR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzc2OTgwMCwiZXhwIjoyMDc5MzQ1ODAwfQ.MEUfQeHZ2kNFT_j06uvAYsQTlwrJvk1_qK-8Z4uguQw';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkSlotDetails() {
    console.log('🔍 Checking Production DB Slot Details...');

    // 1. Get latest purchase
    const { data: purchase, error } = await supabase
        .from('purchased_slots')
        .select('*')
        .order('purchased_at', { ascending: false })
        .limit(1)
        .single();

    if (error || !purchase) {
        console.error('❌ Failed to get purchase:', error);
        return;
    }

    // 2. Get Call Slot details
    const { data: slot, error: slotError } = await supabase
        .from('call_slots')
        .select('*')
        .eq('id', purchase.call_slot_id)
        .single();

    if (slotError) {
        console.error('❌ Failed to get slot:', slotError);
        return;
    }

    console.log('\n--- Slot Details ---');
    console.log(`Title: ${slot.title}`);
    console.log(`Scheduled Start (UTC): ${slot.scheduled_start_time}`);

    const now = new Date();
    const start = new Date(slot.scheduled_start_time);
    console.log(`Current Time (Local System): ${now.toISOString()}`);

    console.log(`Is Past? ${start < now}`);

    // 3. User Details
    console.log('\n--- User Details ---');
    console.log(`Fan User ID (in Slot): ${slot.fan_user_id}`);

    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, auth_user_id, display_name') // email might not be directly available if not in schema, checking generic cols
        .eq('id', slot.fan_user_id)
        .single();

    if (user) {
        console.log(`Linked User Found: ${user.display_name} (Auth: ${user.auth_user_id})`);
    } else {
        console.error('❌ User not found in users table:', userError);
    }

}

checkSlotDetails();
