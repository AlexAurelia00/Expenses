import { supabase, supabaseAdmin } from '../config/supabaseClient.js';
import { createNotification } from '../utils/notifications.js';

// Record a settlement (Settle Up)
export const createSettlement = async (req, res) => {
  const { group_id, to_user, amount, payment_method, status } = req.body;
  const from_user = req.user.id;

  if (!group_id || !to_user || !amount || !payment_method) {
    return res.status(400).json({ error: 'Missing required settlement fields.' });
  }

  try {
    // 1. Verify membership of both users in the group
    const { data: members, error: memError } = await supabaseAdmin
      .from('group_members')
      .select('user_id')
      .eq('group_id', group_id);

    if (memError) throw memError;

    const memberIds = members.map(m => m.user_id);
    if (!memberIds.includes(from_user) || !memberIds.includes(to_user)) {
      return res.status(403).json({ error: 'Both participants must be members of the group.' });
    }

    // 2. Insert settlement
    const { data: settlement, error: setError } = await supabaseAdmin
      .from('settlements')
      .insert({
        group_id,
        from_user,
        to_user,
        amount: parseFloat(amount),
        payment_method,
        status: status || 'completed'
      })
      .select()
      .single();

    if (setError) throw setError;

    // 3. Notify receiver
    const { data: group } = await supabaseAdmin.from('groups').select('name, currency').eq('id', group_id).single();
    const { data: senderProfile } = await supabaseAdmin.from('profiles').select('full_name').eq('id', from_user).single();
    const { data: receiverProfile } = await supabaseAdmin.from('profiles').select('email').eq('id', to_user).single();

    const senderName = senderProfile?.full_name || 'Someone';
    const currency = group?.currency || 'USD';

    await createNotification({
      userId: to_user,
      title: 'Settlement Received',
      message: `${senderName} recorded a payment of ${currency} ${parseFloat(amount).toFixed(2)} to you in "${group?.name}".`,
      type: 'settlement_received',
      emailData: receiverProfile ? {
        email: receiverProfile.email,
        message: `${senderName} recorded a payment of ${currency} ${parseFloat(amount).toFixed(2)} to you in "${group?.name}" on Splitwise Clone.`
      } : null
    });

    return res.status(201).json(settlement);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Update Settlement Status (approve/reject pending payments)
export const updateSettlementStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'completed' or 'rejected'
  const currentUserId = req.user.id;

  if (!status || !['completed', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status must be completed or rejected.' });
  }

  try {
    // 1. Fetch settlement
    const { data: settlement, error: fetchError } = await supabaseAdmin
      .from('settlements')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !settlement) {
      return res.status(404).json({ error: 'Settlement not found.' });
    }

    // 2. Only the recipient (to_user) can update status (confirm receipt)
    if (settlement.to_user !== currentUserId) {
      return res.status(403).json({ error: 'Only the payment recipient can confirm or reject this settlement.' });
    }

    // 3. Update status
    const { data: updatedSettlement, error: updateError } = await supabaseAdmin
      .from('settlements')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 4. Notify sender
    const { data: group } = await supabaseAdmin.from('groups').select('name, currency').eq('id', settlement.group_id).single();
    const { data: receiverProfile } = await supabaseAdmin.from('profiles').select('full_name').eq('id', currentUserId).single();
    const { data: senderProfile } = await supabaseAdmin.from('profiles').select('email').eq('id', settlement.from_user).single();

    const receiverName = receiverProfile?.full_name || 'Someone';
    const currency = group?.currency || 'USD';

    await createNotification({
      userId: settlement.from_user,
      title: `Settlement ${status === 'completed' ? 'Approved' : 'Rejected'}`,
      message: `${receiverName} has ${status} your payment of ${currency} ${parseFloat(settlement.amount).toFixed(2)} in "${group?.name}".`,
      type: 'settlement_received',
      emailData: senderProfile ? {
        email: senderProfile.email,
        message: `${receiverName} has ${status} your payment of ${currency} ${parseFloat(settlement.amount).toFixed(2)} in "${group?.name}" on Splitwise Clone.`
      } : null
    });

    return res.status(200).json(updatedSettlement);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
