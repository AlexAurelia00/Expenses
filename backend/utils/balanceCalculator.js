export const calculateBalancesAndDebts = (members, expenses, splits, settlements) => {
  const memberBalances = {};

  // Initialize balances for each member
  members.forEach(member => {
    memberBalances[member.id] = {
      id: member.id,
      full_name: member.full_name,
      email: member.email,
      avatar_url: member.avatar_url,
      paid: 0,
      share: 0,
      net: 0
    };
  });

  // Calculate total paid by each member
  expenses.forEach(expense => {
    const payerId = expense.paid_by;
    if (memberBalances[payerId]) {
      memberBalances[payerId].paid += parseFloat(expense.amount);
    }
  });

  // Calculate total share (owed) by each member
  splits.forEach(split => {
    const userId = split.user_id;
    if (memberBalances[userId]) {
      memberBalances[userId].share += parseFloat(split.amount);
    }
  });

  // Adjust for settlements
  settlements.forEach(settlement => {
    if (settlement.status !== 'rejected') {
      const fromUser = settlement.from_user;
      const toUser = settlement.to_user;
      const amount = parseFloat(settlement.amount);

      if (memberBalances[fromUser]) {
        // paid goes up for from_user (they paid off debt)
        memberBalances[fromUser].paid += amount;
      }
      if (memberBalances[toUser]) {
        // paid goes down for to_user (they received money, so net decreases)
        memberBalances[toUser].share += amount;
      }
    }
  });

  // Calculate net balances (net = paid - share)
  // positive net means someone is owed money, negative means they owe money
  const balanceList = [];
  Object.keys(memberBalances).forEach(userId => {
    const net = memberBalances[userId].paid - memberBalances[userId].share;
    memberBalances[userId].net = Math.round(net * 100) / 100;
    balanceList.push({
      id: userId,
      full_name: memberBalances[userId].full_name,
      net: memberBalances[userId].net
    });
  });

  // Simplify Debts Algorithm (Greedy approach)
  const debtors = [];
  const creditors = [];

  balanceList.forEach(m => {
    if (m.net < -0.01) {
      debtors.push({ id: m.id, full_name: m.full_name, net: -m.net });
    } else if (m.net > 0.01) {
      creditors.push({ id: m.id, full_name: m.full_name, net: m.net });
    }
  });

  const simplifiedDebts = [];

  let debtorIdx = 0;
  let creditorIdx = 0;

  while (debtorIdx < debtors.length && creditorIdx < creditors.length) {
    const debtor = debtors[debtorIdx];
    const creditor = creditors[creditorIdx];

    const amountToSettle = Math.min(debtor.net, creditor.net);
    
    if (amountToSettle > 0.009) {
      simplifiedDebts.push({
        from: debtor.id,
        from_name: debtor.full_name,
        to: creditor.id,
        to_name: creditor.full_name,
        amount: Math.round(amountToSettle * 100) / 100
      });
    }

    debtor.net -= amountToSettle;
    creditor.net -= amountToSettle;

    if (debtor.net < 0.01) debtorIdx++;
    if (creditor.net < 0.01) creditorIdx++;
  }

  return {
    memberBalances: Object.values(memberBalances),
    simplifiedDebts
  };
};
