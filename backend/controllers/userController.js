import { supabase, supabaseAdmin } from '../config/supabaseClient.js';
import { calculateBalancesAndDebts } from '../utils/balanceCalculator.js';

// Update profile details
export const updateProfile = async (req, res) => {
  const { full_name, mobile, avatar_url } = req.body;
  const userId = req.user.id;

  try {
    const updateData = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (mobile !== undefined) updateData.mobile = mobile;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json(profile);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Delete account (bypasses RLS using Admin client, checks balances first)
export const deleteAccount = async (req, res) => {
  const userId = req.user.id;

  try {
    // 1. Fetch all groups where the user is a member
    const { data: memberships } = await supabaseAdmin
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId);

    const groupIds = memberships ? memberships.map(m => m.group_id) : [];

    // 2. Validate user has 0 balance in all groups
    for (const groupId of groupIds) {
      const { data: members } = await supabase
        .from('group_members')
        .select('role, user_id, profiles(id, full_name, email, avatar_url)')
        .eq('group_id', groupId);

      const formattedMembers = members.map(m => ({
        id: m.profiles.id,
        full_name: m.profiles.full_name,
        email: m.profiles.email,
        avatar_url: m.profiles.avatar_url,
        role: m.role
      }));

      const { data: expenses } = await supabase.from('expenses').select('*').eq('group_id', groupId);
      const { data: settlements } = await supabase.from('settlements').select('*').eq('group_id', groupId);
      
      let splits = [];
      if (expenses.length > 0) {
        const expenseIds = expenses.map(e => e.id);
        const { data: splitsData } = await supabase.from('expense_splits').select('*').in('expense_id', expenseIds);
        splits = splitsData || [];
      }

      const { memberBalances } = calculateBalancesAndDebts(formattedMembers, expenses, splits, settlements);
      const userBalance = memberBalances.find(mb => mb.id === userId);

      if (userBalance && Math.abs(userBalance.net) > 0.01) {
        return res.status(400).json({ 
          error: `Cannot delete account. You have an active balance of ${userBalance.net} in group "${groupId}". All debts must be settled first.` 
        });
      }
    }

    // 3. Delete user from auth schema (cascades to profiles, splits, group_members via FK cascade constraints)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) throw deleteError;

    return res.status(200).json({ message: 'Account deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
