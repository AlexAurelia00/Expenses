import { supabaseAdmin } from '../config/supabaseClient.js';

const [,, groupId, userId] = process.argv;

if (!groupId || !userId) {
  console.error('Usage: node add_creator_member.js <groupId> <userId>');
  process.exit(1);
}

(async function(){
  try {
    // Check if member exists
    const { data: existing, error: existErr } = await supabaseAdmin
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existErr) throw existErr;
    if (existing) {
      console.log('Member already exists.');
      process.exit(0);
    }

    const { data, error } = await supabaseAdmin
      .from('group_members')
      .insert({ group_id: groupId, user_id: userId, role: 'admin' });

    if (error) throw error;
    console.log('Inserted member:', data);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(2);
  }
})();
