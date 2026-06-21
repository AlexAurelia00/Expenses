import { supabase, supabaseAdmin } from '../config/supabaseClient.js';
import { calculateBalancesAndDebts } from '../utils/balanceCalculator.js';
import { createNotification } from '../utils/notifications.js';

// Create a new group
export const createGroup = async (req, res) => {
  const { name, description, image_url, currency } = req.body;
  const userId = req.user.id;

  if (!name) {
    return res.status(400).json({ error: 'Group name is required.' });
  }

  try {
    // 1. Create group entry using service-role client to bypass RLS during creation
    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .insert({
        name,
        description,
        image_url,
        created_by: userId,
        currency: currency || 'USD'
      })
      .select()
      .single();

    if (groupError) throw groupError;

    // 2. Add creator as Admin member
    // Use service-role client to bypass RLS for this initial seed insert
    const { error: memberError } = await supabaseAdmin
      .from('group_members')
      .insert({
        group_id: group.id,
        user_id: userId,
        role: 'admin'
      });

    if (memberError) {
      // Cleanup group if membership insert fails
      await supabaseAdmin.from('groups').delete().eq('id', group.id);
      throw memberError;
    }

    // Fetch members (as admin) and return richer payload so frontend sees membership immediately
    const { data: membersData } = await supabaseAdmin
      .from('group_members')
      .select('role, user_id, profiles(id, full_name, email, mobile, avatar_url)')
      .eq('group_id', group.id);

    const formattedMembers = (membersData || []).map(m => ({
      id: m.profiles.id,
      full_name: m.profiles.full_name,
      email: m.profiles.email,
      mobile: m.profiles.mobile,
      avatar_url: m.profiles.avatar_url,
      role: m.role
    }));

    return res.status(201).json({ ...group, members: formattedMembers });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Get all groups for the logged-in user
export const getGroups = async (req, res) => {
  const userId = req.user.id;

  try {
    // Fetch group member associations
    const { data: memberships, error: memberError } = await supabaseAdmin
      .from('group_members')
      .select('group_id, role')
      .eq('user_id', userId);

    if (memberError) throw memberError;

    // Also include groups where the user is the creator (in case membership rows are missing)
    const creatorGroupsResp = await supabaseAdmin
      .from('groups')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    const creatorGroups = creatorGroupsResp.data || [];

    if ((!memberships || memberships.length === 0) && creatorGroups.length === 0) {
      return res.status(200).json([]);
    }

    const groupIds = new Set((memberships || []).map(m => m.group_id));
    creatorGroups.forEach(g => groupIds.add(g.id));

    // Fetch details of those groups using admin client to avoid RLS issues
    const { data: groups, error: groupError } = await supabaseAdmin
      .from('groups')
      .select('*')
      .in('id', Array.from(groupIds))
      .order('created_at', { ascending: false });

    if (groupError) throw groupError;

    // Append user role in each group
    const groupsWithRole = groups.map(group => {
      const membership = memberships.find(m => m.group_id === group.id);
      return {
        ...group,
        role: membership ? membership.role : 'member'
      };
    });

    return res.status(200).json(groupsWithRole);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Get group by ID (with details, members, expenses, settlements, balances, and simplified debts)
export const getGroupById = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    // 1. Check if user is a member of the group
    const { data: membership, error: memError } = await supabaseAdmin
      .from('group_members')
      .select('role')
      .eq('group_id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (memError) throw memError;

    let effectiveMembership = membership;
    if (!membership) {
      // Use admin client to read group metadata (avoids RLS blocking when policies are restrictive)
      const { data: grp, error: grpErr } = await supabaseAdmin
        .from('groups')
        .select('created_by')
        .eq('id', id)
        .maybeSingle();
      if (grpErr) throw grpErr;
      if (!grp) return res.status(404).json({ error: 'Group not found.' });
      if (grp.created_by !== userId) {
        return res.status(403).json({ error: 'Access Denied. You are not a member of this group.' });
      }

      // Treat creator as admin for this request path
      effectiveMembership = { role: 'admin' };
    }

    // 2. Fetch group detail
    // Fetch group using admin client so the server can return full details even under RLS
    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .select('*')
      .eq('id', id)
      .single();

    if (groupError) throw groupError;

    // 3. Fetch all group members with profile details
    const { data: members, error: membersError } = await supabaseAdmin
      .from('group_members')
      .select('role, user_id, profiles(id, full_name, email, mobile, avatar_url)')
      .eq('group_id', id);

    if (membersError) throw membersError;

    const formattedMembers = members.map(m => ({
      id: m.profiles.id,
      full_name: m.profiles.full_name,
      email: m.profiles.email,
      mobile: m.profiles.mobile,
      avatar_url: m.profiles.avatar_url,
      role: m.role
    }));

    // 4. Fetch all expenses (use admin client to avoid RLS read issues)
    const { data: expenses, error: expensesError } = await supabaseAdmin
      .from('expenses')
      .select('*')
      .eq('group_id', id)
      .order('expense_date', { ascending: false });

    if (expensesError) throw expensesError;

    // 5. Fetch all expense splits for these expenses (admin client)
    let splits = [];
    if (expenses.length > 0) {
      const expenseIds = expenses.map(e => e.id);
      const { data: splitsData, error: splitsError } = await supabaseAdmin
        .from('expense_splits')
        .select('*')
        .in('expense_id', expenseIds);

      if (splitsError) throw splitsError;
      splits = splitsData;
    }

    // 6. Fetch settlements (admin client)
    const { data: settlements, error: settlementsError } = await supabaseAdmin
      .from('settlements')
      .select('*')
      .eq('group_id', id)
      .order('created_at', { ascending: false });

    if (settlementsError) throw settlementsError;

    // 7. Calculate balances and simplified debts
    const { memberBalances, simplifiedDebts } = calculateBalancesAndDebts(
      formattedMembers,
      expenses,
      splits,
      settlements
    );

    return res.status(200).json({
      group,
      members: formattedMembers,
      expenses,
      splits,
      settlements,
      balances: memberBalances,
      simplifiedDebts
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Add a member by email
export const addMember = async (req, res) => {
  const { id } = req.params;
  const { email } = req.body;
  const currentUserId = req.user.id;

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    // 1. Verify that requester is an admin in this group.
    // Allow the group's creator (`groups.created_by`) to act as admin as well.
    const { data: requesterMem, error: reqMemError } = await supabaseAdmin
      .from('group_members')
      .select('role')
      .eq('group_id', id)
      .eq('user_id', currentUserId)
      .maybeSingle();

    if (reqMemError) throw reqMemError;

    let isAdmin = requesterMem && requesterMem.role === 'admin';
    if (!isAdmin) {
      // Use admin client to read group.created_by to avoid RLS blocking
      const { data: grp, error: grpErr } = await supabaseAdmin
        .from('groups')
        .select('created_by')
        .eq('id', id)
        .maybeSingle();
      if (grpErr) throw grpErr;
      if (grp && grp.created_by === currentUserId) isAdmin = true;
    }

    if (!isAdmin) {
      return res.status(403).json({ error: 'Access Denied. Only group admins can invite members.' });
    }

    // 2. Lookup user profile by email
    const { data: targetUser, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (userError) throw userError;

    if (!targetUser) {
      // User is not registered in the system yet.
      // Send invite email using nodemailer
      const { data: group } = await supabase.from('groups').select('name').eq('id', id).single();
      await createNotification({
        userId: currentUserId, // Log under admin
        title: 'Group Invitation Sent',
        message: `An invitation email was sent to ${email} to join the group "${group?.name || 'Expense Group'}".`,
        type: 'group_invite',
        emailData: {
          email,
          message: `You have been invited to join the group "${group?.name || 'Expense Group'}" on Splitwise Clone. Please register an account using this email to join the group!`
        }
      });

      return res.status(404).json({ 
        error: 'User email not found in our database. We have sent an email invite to join Splitwise Clone!' 
      });
    }

    // 3. Check if target user is already in group (use admin client)
    const { data: existingMember, error: existError } = await supabaseAdmin
      .from('group_members')
      .select('id')
      .eq('group_id', id)
      .eq('user_id', targetUser.id)
      .maybeSingle();

    if (existError) throw existError;
    if (existingMember) {
      return res.status(400).json({ error: 'User is already a member of this group.' });
    }

    // 4. Add user to group using admin client to bypass RLS
    const { error: insertError } = await supabaseAdmin
      .from('group_members')
      .insert({
        group_id: id,
        user_id: targetUser.id,
        role: 'member'
      });

    if (insertError) throw insertError;

    // 5. Send notification to added member
    const { data: group } = await supabaseAdmin.from('groups').select('name').eq('id', id).single();
    await createNotification({
      userId: targetUser.id,
      title: 'Added to Group',
      message: `You have been added to the group "${group?.name}" by ${req.user.user_metadata?.full_name || 'Admin'}.`,
      type: 'group_invite',
      emailData: {
        email: targetUser.email,
        message: `You have been added to the group "${group?.name}" by ${req.user.user_metadata?.full_name || 'Admin'} on Splitwise Clone.`
      }
    });

    return res.status(200).json({ message: 'Member added successfully!', member: targetUser });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Remove a member from the group (Only by Admin, and balance must be zero)
export const removeMember = async (req, res) => {
  const { id, userId } = req.params;
  const currentUserId = req.user.id;

  try {
    // 1. Verify requester is admin (or group creator)
    const { data: requesterMem } = await supabaseAdmin
      .from('group_members')
      .select('role')
      .eq('group_id', id)
      .eq('user_id', currentUserId)
      .maybeSingle();

    let isAdminRem = requesterMem && requesterMem.role === 'admin';
    if (!isAdminRem) {
      const { data: grp, error: grpErr } = await supabaseAdmin
        .from('groups')
        .select('created_by')
        .eq('id', id)
        .maybeSingle();
      if (grpErr) throw grpErr;
      if (grp && grp.created_by === currentUserId) isAdminRem = true;
    }

    if (!isAdminRem) {
      return res.status(403).json({ error: 'Access Denied. Only group admins can remove members.' });
    }

    // 2. Fetch group data to calculate balances
    const { data: members } = await supabaseAdmin
      .from('group_members')
      .select('role, user_id, profiles(id, full_name, email, avatar_url)')
      .eq('group_id', id);

    const formattedMembers = members.map(m => ({
      id: m.profiles.id,
      full_name: m.profiles.full_name,
      email: m.profiles.email,
      avatar_url: m.profiles.avatar_url,
      role: m.role
    }));

    const { data: expenses } = await supabase.from('expenses').select('*').eq('group_id', id);
    const { data: settlements } = await supabase.from('settlements').select('*').eq('group_id', id);

    let splits = [];
    if (expenses.length > 0) {
      const expenseIds = expenses.map(e => e.id);
      const { data: splitsData } = await supabase.from('expense_splits').select('*').in('expense_id', expenseIds);
      splits = splitsData || [];
    }

    const { memberBalances } = calculateBalancesAndDebts(formattedMembers, expenses, splits, settlements);
    const targetBalance = memberBalances.find(mb => mb.id === userId);

    if (targetBalance && Math.abs(targetBalance.net) > 0.01) {
      return res.status(400).json({ 
        error: `Cannot remove member. This user has an outstanding balance of ${targetBalance.net}. All debts must be settled first.` 
      });
    }

    // 3. Remove member
    const { error: deleteError } = await supabaseAdmin
      .from('group_members')
      .delete()
      .eq('group_id', id)
      .eq('user_id', userId);

    if (deleteError) throw deleteError;

    // Send notification
    await createNotification({
      userId,
      title: 'Removed from Group',
      message: `You were removed from group by ${req.user.user_metadata?.full_name || 'Admin'}.`,
      type: 'group_invite'
    });

    return res.status(200).json({ message: 'Member removed successfully.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Leave the group (balance must be zero)
export const leaveGroup = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    // 1. Fetch group data to calculate balances
    const { data: members } = await supabaseAdmin
      .from('group_members')
      .select('role, user_id, profiles(id, full_name, email, avatar_url)')
      .eq('group_id', id);

    if (!members.some(m => m.user_id === userId)) {
      return res.status(400).json({ error: 'You are not a member of this group.' });
    }

    const formattedMembers = members.map(m => ({
      id: m.profiles.id,
      full_name: m.profiles.full_name,
      email: m.profiles.email,
      avatar_url: m.profiles.avatar_url,
      role: m.role
    }));

    const { data: expenses } = await supabase.from('expenses').select('*').eq('group_id', id);
    const { data: settlements } = await supabase.from('settlements').select('*').eq('group_id', id);

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
        error: `Cannot leave group. You have an outstanding balance of ${userBalance.net}. Please settle up before leaving.` 
      });
    }

    // Check if user is the last admin
    const admins = formattedMembers.filter(m => m.role === 'admin');
    const isUserAdmin = formattedMembers.find(m => m.id === userId)?.role === 'admin';
    if (isUserAdmin && admins.length === 1 && formattedMembers.length > 1) {
      return res.status(400).json({ 
        error: 'You are the only Admin. Please promote another member to Admin before leaving.' 
      });
    }

    // 2. Leave group
    const { error: deleteError } = await supabaseAdmin
      .from('group_members')
      .delete()
      .eq('group_id', id)
      .eq('user_id', userId);

    if (deleteError) throw deleteError;

    return res.status(200).json({ message: 'You have left the group successfully.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Update a member's role (Support multiple admins)
export const updateMemberRole = async (req, res) => {
  const { id, userId } = req.params;
  const { role } = req.body;
  const currentUserId = req.user.id;

  if (!role || !['admin', 'member'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin or member.' });
  }

  try {
    // 1. Verify requester is admin (or group creator)
    const { data: requesterMem } = await supabaseAdmin
      .from('group_members')
      .select('role')
      .eq('group_id', id)
      .eq('user_id', currentUserId)
      .maybeSingle();

    let isAdminUpdate = requesterMem && requesterMem.role === 'admin';
    if (!isAdminUpdate) {
      const { data: grp, error: grpErr } = await supabaseAdmin
        .from('groups')
        .select('created_by')
        .eq('id', id)
        .maybeSingle();
      if (grpErr) throw grpErr;
      if (grp && grp.created_by === currentUserId) isAdminUpdate = true;
    }

    if (!isAdminUpdate) {
      return res.status(403).json({ error: 'Access Denied. Only group admins can manage roles.' });
    }

    // 2. Update role
    const { error: updateError } = await supabaseAdmin
      .from('group_members')
      .update({ role })
      .eq('group_id', id)
      .eq('user_id', userId);

    if (updateError) throw updateError;

    // Send notification
    await createNotification({
      userId,
      title: 'Role Updated',
      message: `Your role in group has been updated to "${role}" by ${req.user.user_metadata?.full_name || 'Admin'}.`,
      type: 'group_invite'
    });

    return res.status(200).json({ message: `Role updated to ${role} successfully.` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Delete a group (only admin or creator)
export const deleteGroup = async (req, res) => {
  const { id } = req.params;
  const currentUserId = req.user.id;

  try {
    // Verify requester is admin in group_members
    const { data: requesterMem, error: reqMemErr } = await supabaseAdmin
      .from('group_members')
      .select('role')
      .eq('group_id', id)
      .eq('user_id', currentUserId)
      .maybeSingle();

    if (reqMemErr) throw reqMemErr;

    let isAdmin = requesterMem && requesterMem.role === 'admin';
    if (!isAdmin) {
      // Check if requester is group creator (use admin client)
      const { data: grp, error: grpErr } = await supabaseAdmin
        .from('groups')
        .select('created_by')
        .eq('id', id)
        .maybeSingle();
      if (grpErr) throw grpErr;
      if (!grp) return res.status(404).json({ error: 'Group not found.' });
      if (grp.created_by === currentUserId) isAdmin = true;
    }

    if (!isAdmin) return res.status(403).json({ error: 'Access Denied. Only group admins can delete the group.' });

    // Delete group using admin client to bypass RLS and cascade
    const { error: delErr } = await supabaseAdmin
      .from('groups')
      .delete()
      .eq('id', id);

    if (delErr) throw delErr;

    return res.status(200).json({ message: 'Group deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
