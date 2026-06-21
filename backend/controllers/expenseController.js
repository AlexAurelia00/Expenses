import { supabase, supabaseAdmin } from '../config/supabaseClient.js';
import { createNotification } from '../utils/notifications.js';

// Calculate splits precisely based on split type
const distributeSplits = (totalAmount, splitType, splitsInput, allGroupMemberIds) => {
  const amount = parseFloat(totalAmount);
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Invalid expense amount.');
  }

  let finalSplits = []; // array of { user_id, amount, percentage, shares }
  let sumCalculated = 0;

  if (splitType === 'equal') {
    // If splitsInput is empty, split among all group members
    const targetUsers = splitsInput && splitsInput.length > 0
      ? splitsInput.map(s => s.user_id)
      : allGroupMemberIds;

    const count = targetUsers.length;
    if (count === 0) throw new Error('No participants specified for equal split.');

    const baseShare = Math.floor((amount / count) * 100) / 100;
    let remainder = Math.round((amount - (baseShare * count)) * 100) / 100;

    targetUsers.forEach((userId, index) => {
      let userAmount = baseShare;
      // Distribute remainder cents to the first users
      if (remainder > 0) {
        userAmount = Math.round((userAmount + 0.01) * 100) / 100;
        remainder = Math.round((remainder - 0.01) * 100) / 100;
      }
      finalSplits.push({
        user_id: userId,
        amount: userAmount,
        percentage: Math.round((userAmount / amount) * 10000) / 100,
        shares: 1
      });
      sumCalculated += userAmount;
    });

  } else if (splitType === 'exact') {
    if (!splitsInput || splitsInput.length === 0) {
      throw new Error('Splits details are required for exact split.');
    }

    let inputSum = 0;
    splitsInput.forEach(s => {
      const val = parseFloat(s.value);
      if (isNaN(val) || val < 0) throw new Error('Split values must be non-negative numbers.');
      inputSum += val;
      finalSplits.push({
        user_id: s.user_id,
        amount: Math.round(val * 100) / 100,
        percentage: null,
        shares: null
      });
    });

    // Check sum match
    const diff = Math.abs(amount - inputSum);
    if (diff > 0.02) {
      throw new Error(`The sum of split amounts (${inputSum.toFixed(2)}) must equal the expense total (${amount.toFixed(2)}).`);
    }

  } else if (splitType === 'percentage') {
    if (!splitsInput || splitsInput.length === 0) {
      throw new Error('Splits details are required for percentage split.');
    }

    let percentageSum = 0;
    splitsInput.forEach(s => {
      const pct = parseFloat(s.value);
      if (isNaN(pct) || pct < 0) throw new Error('Percentages must be non-negative.');
      percentageSum += pct;
    });

    if (Math.abs(percentageSum - 100) > 0.01) {
      throw new Error(`Percentages must sum up to exactly 100%. Got ${percentageSum}%.`);
    }

    let remainder = amount;
    splitsInput.forEach((s, idx) => {
      const pct = parseFloat(s.value);
      let userAmount = Math.round(((pct / 100) * amount) * 100) / 100;
      
      // For the last user, absorb any rounding difference
      if (idx === splitsInput.length - 1) {
        userAmount = Math.round(remainder * 100) / 100;
      } else {
        remainder -= userAmount;
      }

      finalSplits.push({
        user_id: s.user_id,
        amount: userAmount,
        percentage: pct,
        shares: null
      });
    });

  } else if (splitType === 'shares') {
    if (!splitsInput || splitsInput.length === 0) {
      throw new Error('Splits details are required for shares split.');
    }

    let totalShares = 0;
    splitsInput.forEach(s => {
      const sh = parseInt(s.value);
      if (isNaN(sh) || sh <= 0) throw new Error('Shares must be positive integers.');
      totalShares += sh;
    });

    if (totalShares === 0) throw new Error('Total shares cannot be zero.');

    let remainder = amount;
    splitsInput.forEach((s, idx) => {
      const sh = parseInt(s.value);
      let userAmount = Math.round(((sh / totalShares) * amount) * 100) / 100;

      // Absorb rounding in the last index
      if (idx === splitsInput.length - 1) {
        userAmount = Math.round(remainder * 100) / 100;
      } else {
        remainder -= userAmount;
      }

      finalSplits.push({
        user_id: s.user_id,
        amount: userAmount,
        percentage: Math.round((userAmount / amount) * 10000) / 100,
        shares: sh
      });
    });
  } else {
    throw new Error('Invalid split type. Must be equal, exact, percentage, or shares.');
  }

  return finalSplits;
};

// Add Expense
export const addExpense = async (req, res) => {
  const {
    group_id,
    title,
    description,
    amount,
    paid_by,
    category,
    receipt_url,
    expense_date,
    split_type,
    splits
  } = req.body;

  const currentUserId = req.user.id;

  if (!group_id || !title || !amount || !category || !split_type) {
    return res.status(400).json({ error: 'Missing required expense fields.' });
  }

  try {
    // 1. Verify user is in group (allow group creator as member)
    const { data: membership } = await supabaseAdmin
      .from('group_members')
      .select('id')
      .eq('group_id', group_id)
      .eq('user_id', currentUserId)
      .maybeSingle();

    if (!membership) {
      // Check if user is the group's creator via admin client
      const { data: grp, error: grpErr } = await supabaseAdmin
        .from('groups')
        .select('created_by')
        .eq('id', group_id)
        .maybeSingle();
      if (grpErr) throw grpErr;
      if (!grp || grp.created_by !== currentUserId) {
        return res.status(403).json({ error: 'Access Denied. You are not a member of this group.' });
      }
    }

    // 2. Fetch all members of the group (for default equal splits validation)
    const { data: groupMembers } = await supabaseAdmin
      .from('group_members')
      .select('user_id')
      .eq('group_id', group_id);
    
    const memberIds = groupMembers.map(m => m.user_id);

    // 3. Compute splits
    let calculatedSplits;
    try {
      calculatedSplits = distributeSplits(amount, split_type, splits, memberIds);
    } catch (calcError) {
      return res.status(400).json({ error: calcError.message });
    }

    // 4. Create expense entry (use admin client to bypass RLS during creation)
    const payerId = paid_by || currentUserId;
    const { data: expense, error: expError } = await supabaseAdmin
      .from('expenses')
      .insert({
        group_id,
        title,
        description,
        amount: parseFloat(amount),
        paid_by: payerId,
        category,
        receipt_url,
        expense_date: expense_date || new Date().toISOString()
      })
      .select()
      .single();

    if (expError) throw expError;

    // 5. Create splits entries
    const splitsPayload = calculatedSplits.map(s => ({
      expense_id: expense.id,
      user_id: s.user_id,
      amount: s.amount,
      percentage: s.percentage,
      shares: s.shares
    }));

    const { error: splitError } = await supabaseAdmin
      .from('expense_splits')
      .insert(splitsPayload);

    if (splitError) {
      // Rollback expense
      await supabaseAdmin.from('expenses').delete().eq('id', expense.id);
      throw splitError;
    }

    // 6. Notify group members in background
    const { data: group } = await supabaseAdmin.from('groups').select('name, currency').eq('id', group_id).single();
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id, email, full_name');
    
    const payerProfile = profiles.find(p => p.id === payerId);
    const payerName = payerProfile?.full_name || 'Someone';

    calculatedSplits.forEach(async (cs) => {
      // Don't notify the payer about their own payment, unless they owe themselves (which they don't count as notification)
      if (cs.user_id !== payerId) {
        const userProfile = profiles.find(p => p.id === cs.user_id);
        await createNotification({
          userId: cs.user_id,
          title: 'New Expense Added',
          message: `${payerName} added "${title}" in "${group?.name}". You owe ${group?.currency || 'USD'} ${cs.amount.toFixed(2)}.`,
          type: 'expense_added',
          emailData: userProfile ? {
            email: userProfile.email,
            message: `${payerName} added "${title}" in "${group?.name}". You owe ${group?.currency || 'USD'} ${cs.amount.toFixed(2)}. Log in to Splitwise Clone to view details!`
          } : null
        });
      }
    });

    return res.status(201).json({ expense, splits: splitsPayload });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Update Expense
export const updateExpense = async (req, res) => {
  const { id } = req.params;
  const {
    title,
    description,
    amount,
    paid_by,
    category,
    receipt_url,
    expense_date,
    split_type,
    splits
  } = req.body;

  const currentUserId = req.user.id;

  try {
    // 1. Fetch existing expense
    const { data: oldExpense, error: fetchError } = await supabaseAdmin
      .from('expenses')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !oldExpense) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    // 2. Verify user is in group
    const { data: membership } = await supabaseAdmin
      .from('group_members')
      .select('id')
      .eq('group_id', oldExpense.group_id)
      .eq('user_id', currentUserId)
      .maybeSingle();

    if (!membership) {
      return res.status(403).json({ error: 'Access Denied. You are not a member of this group.' });
    }

    // 3. Fetch group members
    const { data: groupMembers } = await supabaseAdmin
      .from('group_members')
      .select('user_id')
      .eq('group_id', oldExpense.group_id);
    
    const memberIds = groupMembers.map(m => m.user_id);

    // 4. Recalculate splits
    const targetAmount = amount !== undefined ? amount : oldExpense.amount;
    const targetSplitType = split_type !== undefined ? split_type : 'equal'; // default if unknown
    let calculatedSplits;
    try {
      calculatedSplits = distributeSplits(targetAmount, targetSplitType, splits, memberIds);
    } catch (calcError) {
      return res.status(400).json({ error: calcError.message });
    }

    // 5. Update expense details
    const { data: updatedExpense, error: updateError } = await supabaseAdmin
      .from('expenses')
      .update({
        title: title || oldExpense.title,
        description: description !== undefined ? description : oldExpense.description,
        amount: parseFloat(targetAmount),
        paid_by: paid_by || oldExpense.paid_by,
        category: category || oldExpense.category,
        receipt_url: receipt_url !== undefined ? receipt_url : oldExpense.receipt_url,
        expense_date: expense_date || oldExpense.expense_date
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 6. Delete old splits
    await supabaseAdmin.from('expense_splits').delete().eq('expense_id', id);

    // 7. Insert new splits
    const splitsPayload = calculatedSplits.map(s => ({
      expense_id: id,
      user_id: s.user_id,
      amount: s.amount,
      percentage: s.percentage,
      shares: s.shares
    }));

    const { error: splitError } = await supabaseAdmin
      .from('expense_splits')
      .insert(splitsPayload);

    if (splitError) throw splitError;

    // 8. Notify members of update
    const { data: group } = await supabaseAdmin.from('groups').select('name, currency').eq('id', oldExpense.group_id).single();
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id, email, full_name');
    const updaterName = req.user.user_metadata?.full_name || 'Someone';

    calculatedSplits.forEach(async (cs) => {
      if (cs.user_id !== currentUserId) {
        const userProfile = profiles.find(p => p.id === cs.user_id);
        await createNotification({
          userId: cs.user_id,
          title: 'Expense Updated',
          message: `"${oldExpense.title}" in "${group?.name}" was updated by ${updaterName}. Your new share is ${group?.currency || 'USD'} ${cs.amount.toFixed(2)}.`,
          type: 'expense_updated',
          emailData: userProfile ? {
            email: userProfile.email,
            message: `"${oldExpense.title}" in "${group?.name}" was updated by ${updaterName}. Your new share is ${group?.currency || 'USD'} ${cs.amount.toFixed(2)}.`
          } : null
        });
      }
    });

    return res.status(200).json({ expense: updatedExpense, splits: splitsPayload });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Delete Expense
export const deleteExpense = async (req, res) => {
  const { id } = req.params;
  const currentUserId = req.user.id;

  try {
    // 1. Fetch expense details
    const { data: expense, error: fetchError } = await supabaseAdmin
      .from('expenses')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !expense) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    // 2. Check membership
    const { data: membership } = await supabaseAdmin
      .from('group_members')
      .select('id')
      .eq('group_id', expense.group_id)
      .eq('user_id', currentUserId)
      .maybeSingle();

    if (!membership) {
      return res.status(403).json({ error: 'Access Denied. You are not a member of this group.' });
    }

    // 3. Delete expense (automatically deletes splits cascade)
    const { error: deleteError } = await supabaseAdmin
      .from('expenses')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    // 4. Notify members
    const { data: group } = await supabaseAdmin.from('groups').select('name, currency').eq('id', expense.group_id).single();
    const { data: groupMembers } = await supabaseAdmin.from('group_members').select('user_id').eq('group_id', expense.group_id);
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id, email, full_name');
    const deleterName = req.user.user_metadata?.full_name || 'Someone';

    groupMembers.forEach(async (m) => {
      if (m.user_id !== currentUserId) {
        const userProfile = profiles.find(p => p.id === m.user_id);
        await createNotification({
          userId: m.user_id,
          title: 'Expense Deleted',
          message: `Expense "${expense.title}" in "${group?.name}" was deleted by ${deleterName}.`,
          type: 'expense_updated',
          emailData: userProfile ? {
            email: userProfile.email,
            message: `Expense "${expense.title}" in "${group?.name}" was deleted by ${deleterName}.`
          } : null
        });
      }
    });

    return res.status(200).json({ message: 'Expense deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
