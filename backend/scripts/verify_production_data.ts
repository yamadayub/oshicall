import { createClient } from '@supabase/supabase-js';

// Production Credentials (atkhwwqunwmpzqkgavtx)
const SUPABASE_URL = 'https://atkhwwqunwmpzqkgavtx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0a2h3d3F1bndtcHpxa2dhdnR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzc2OTgwMCwiZXhwIjoyMDc5MzQ1ODAwfQ.MEUfQeHZ2kNFT_j06uvAYsQTlwrJvk1_qK-8Z4uguQw';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verifyData() {
    console.log('🔍 Connecting to Production DB:', SUPABASE_URL);

    try {
        // 1. Get the 5 most recent purchased_slots
        const { data: purchases, error: purchaseError } = await supabase
            .from('purchased_slots')
            .select('id, purchased_at, fan_user_id, call_slot_id, winning_bid_amount')
            .order('purchased_at', { ascending: false })
            .limit(5);

        if (purchaseError) {
            console.error('❌ Error fetching purchases:', purchaseError);
            return;
        }

        console.log(`📋 Found ${purchases.length} recent purchases:`);

        for (const purchase of purchases) {
            console.log(`\n--- Purchase ID: ${purchase.id} ---`);
            console.log(`Purchased At: ${purchase.purchased_at}`);
            console.log(`Fan User ID (Purchased): ${purchase.fan_user_id}`);
            console.log(`Call Slot ID: ${purchase.call_slot_id}`);

            // 2. Get the corresponding call_slot
            const { data: callSlot, error: slotError } = await supabase
                .from('call_slots')
                .select('id, fan_user_id, title, status')
                .eq('id', purchase.call_slot_id)
                .single();

            if (slotError) {
                console.error('❌ Error fetching call slot:', slotError);
                continue;
            }

            if (!callSlot) {
                console.error('❌ Call Slot NOT FOUND!');
                continue;
            }

            console.log(`Call Slot Title: ${callSlot.title}`);
            console.log(`Call Slot Status: ${callSlot.status}`);
            console.log(`Call Slot Fan User ID: ${callSlot.fan_user_id}`);

            // 3. Check consistency
            if (callSlot.fan_user_id === purchase.fan_user_id) {
                console.log('✅ MATCH: fan_user_id matches between purchased_slots and call_slots.');
            } else if (callSlot.fan_user_id === null) {
                console.log('❌ MISMATCH: call_slots.fan_user_id is NULL! (This causes the bug)');

                // Attempt Fix
                console.log('🛠 Attempting auto-fix for this record...');
                const { error: fixError } = await supabase
                    .from('call_slots')
                    .update({ fan_user_id: purchase.fan_user_id })
                    .eq('id', callSlot.id);

                if (fixError) {
                    console.error('❌ Fix failed:', fixError);
                } else {
                    console.log('✅ Fix applied! call_slots.fan_user_id updated.');
                }

            } else {
                console.log(`⚠️ MISMATCH: IDs differ! CallSlot: ${callSlot.fan_user_id} vs Purchased: ${purchase.fan_user_id}`);
            }
        }

    } catch (err) {
        console.error('❌ Unexpected error:', err);
    }
}

verifyData();
