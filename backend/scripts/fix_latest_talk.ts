import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
const result1 = dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const result2 = dotenv.config({ path: path.resolve(__dirname, '../.env') }); // Try backend/.env

console.log('Env loading results:', {
    rootEnv: result1.error ? 'Error' : 'Loaded',
    backendEnv: result2.error ? 'Error' : 'Loaded'
});

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; // Use SERVICE_ROLE_KEY for admin rights

console.log('Credentials check:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey,
    urlPreview: supabaseUrl ? supabaseUrl.slice(0, 20) + '...' : 'none',
    keyPreview: supabaseKey ? supabaseKey.slice(0, 5) + '...' : 'none'
});

// Hardcode check - if likely wrong, warn.
if (supabaseUrl && supabaseUrl.includes('bp')) {
    console.warn('⚠️ WARNING: URL seems to be a local or staging URL starting with bp...?');
}

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixLatestTalk() {
    console.log('🔍 Checking for recent purchased slots with missing fan_user_id in call_slots...');

    try {
        // 1. Get the most recent purchased_slot
        const { data: latestPurchase, error: purchaseError } = await supabase
            .from('purchased_slots')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (purchaseError) {
            console.error('❌ Error fetching latest purchase:', purchaseError);
            return;
        }

        if (!latestPurchase) {
            console.log('⚠️ No purchased slots found.');
            return;
        }

        console.log('Found latest purchase:', {
            id: latestPurchase.id,
            call_slot_id: latestPurchase.call_slot_id,
            fan_user_id: latestPurchase.fan_user_id,
            created_at: latestPurchase.created_at
        });

        // 2. Check the corresponding call_slot
        const { data: callSlot, error: slotError } = await supabase
            .from('call_slots')
            .select('id, fan_user_id, title')
            .eq('id', latestPurchase.call_slot_id)
            .single();

        if (slotError) {
            console.error('❌ Error fetching call slot:', slotError);
            return;
        }

        if (!callSlot) {
            console.error('❌ Call slot not found for ID:', latestPurchase.call_slot_id);
            return;
        }

        console.log('Current call slot status:', callSlot);

        // 3. Update if missing
        if (!callSlot.fan_user_id) {
            console.log('⚠️ fan_user_id is MISSING in call_slots. Updating now...');

            const { error: updateError } = await supabase
                .from('call_slots')
                .update({ fan_user_id: latestPurchase.fan_user_id })
                .eq('id', callSlot.id);

            if (updateError) {
                console.error('❌ Error updating call slot:', updateError);
            } else {
                console.log('✅ Successfully updated call_slot with fan_user_id!');
            }
        } else {
            console.log('✅ fan_user_id is already set in call_slots. No action needed.');
        }

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

fixLatestTalk();
