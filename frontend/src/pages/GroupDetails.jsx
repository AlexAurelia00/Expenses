import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, supabase } from '../services/api.js';
import { 
  ArrowLeft, 
  Plus, 
  Coins, 
  Check, 
  Trash2, 
  UserPlus, 
  Settings, 
  Search, 
  Filter, 
  CreditCard, 
  DollarSign, 
  X,
  Sparkles,
  Info,
  ChevronDown
} from 'lucide-react';

const CATEGORIES = ['Food', 'Travel', 'Shopping', 'Rent', 'Utilities', 'Healthcare', 'Education', 'Entertainment', 'Other'];

export default function GroupDetails({ userSession }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUserId = userSession.user.id;

  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [splits, setSplits] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [balances, setBalances] = useState([]);
  const [simplifiedDebts, setSimplifiedDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Modals visibility
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Add Expense Form State
  const [expenseId, setExpenseId] = useState(null); // for editing
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Food');
  const [expensePayer, setExpensePayer] = useState(currentUserId);
  const [expenseSplitType, setExpenseSplitType] = useState('equal');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().substring(0, 16));
  const [expenseReceipt, setExpenseReceipt] = useState('');
  // Splits values: user_id -> value (exact, percentage, or share)
  const [participantSplits, setParticipantSplits] = useState({}); // { [userId]: { selected: boolean, value: string } }
  const [expenseSubmitLoading, setExpenseSubmitLoading] = useState(false);

  // Settle Up Form State
  const [settleFrom, setSettleFrom] = useState(currentUserId);
  const [settleTo, setSettleTo] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState('Cash');
  const [settleSubmitLoading, setSettleSubmitLoading] = useState(false);

  // Invite Member State
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  const fetchGroupDetails = async () => {
    try {
      const data = await api.get(`/groups/${id}`);
      setGroup(data.group);
      setMembers(data.members);
      setExpenses(data.expenses);
      setSplits(data.splits);
      setSettlements(data.settlements);
      setBalances(data.balances);
      setSimplifiedDebts(data.simplifiedDebts);
      
      // Setup initial participants values for splits
      const initialSplits = {};
      data.members.forEach(m => {
        initialSplits[m.id] = { selected: true, value: '' };
      });
      setParticipantSplits(initialSplits);

      // Default settle target
      if (data.simplifiedDebts.length > 0) {
        const firstDebt = data.simplifiedDebts.find(d => d.from === currentUserId || d.to === currentUserId);
        if (firstDebt) {
          setSettleFrom(firstDebt.from);
          setSettleTo(firstDebt.to);
          setSettleAmount(firstDebt.amount.toString());
        } else {
          setSettleTo(data.members.find(m => m.id !== currentUserId)?.id || '');
        }
      } else {
        setSettleTo(data.members.find(m => m.id !== currentUserId)?.id || '');
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupDetails();
  }, [id]);

  // Handle image upload / avatar placeholder
  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'GP';

  // invite user
  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviteLoading(true);
    try {
      await api.post(`/groups/${id}/members`, { email: inviteEmail });
      alert('Member added successfully!');
      setInviteEmail('');
      setIsInviteModalOpen(false);
      fetchGroupDetails();
    } catch (err) {
      alert(err.message);
    } finally {
      setInviteLoading(false);
    }
  };

  // leave group
  const handleLeaveGroup = async () => {
    if (!window.confirm('Are you sure you want to leave this group?')) return;
    try {
      await api.post(`/groups/${id}/leave`, {});
      navigate('/');
    } catch (err) {
      alert(err.message);
    }
  };

  // remove member
  const handleRemoveMember = async (userId, name) => {
    if (!window.confirm(`Are you sure you want to remove ${name} from this group?`)) return;
    try {
      await api.delete(`/groups/${id}/members/${userId}`);
      fetchGroupDetails();
    } catch (err) {
      alert(err.message);
    }
  };

  // promote member to admin
  const handlePromoteRole = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    if (!window.confirm(`Change role to ${newRole}?`)) return;
    try {
      await api.put(`/groups/${id}/members/${userId}/role`, { role: newRole });
      fetchGroupDetails();
    } catch (err) {
      alert(err.message);
    }
  };

  // Add/Edit expense submit
  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const amountNum = parseFloat(expenseAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid expense amount.');
      return;
    }

    setExpenseSubmitLoading(true);

    try {
      // Map splits array payload
      const splitsArray = [];
      const selectedMembers = Object.keys(participantSplits).filter(mId => participantSplits[mId].selected);

      if (selectedMembers.length === 0) {
        throw new Error('Please select at least one participant to split the bill.');
      }

      if (expenseSplitType === 'equal') {
        selectedMembers.forEach(mId => {
          splitsArray.push({ user_id: mId });
        });
      } else {
        selectedMembers.forEach(mId => {
          splitsArray.push({
            user_id: mId,
            value: parseFloat(participantSplits[mId].value || '0')
          });
        });
      }

      const payload = {
        group_id: id,
        title: expenseTitle,
        description: expenseDesc,
        amount: amountNum,
        paid_by: expensePayer,
        category: expenseCategory,
        receipt_url: expenseReceipt,
        expense_date: new Date(expenseDate).toISOString(),
        split_type: expenseSplitType,
        splits: splitsArray
      };

      if (expenseId) {
        await api.put(`/expenses/${expenseId}`, payload);
      } else {
        await api.post('/expenses', payload);
      }

      setIsExpenseModalOpen(false);
      resetExpenseForm();
      fetchGroupDetails();
    } catch (err) {
      alert(err.message);
    } finally {
      setExpenseSubmitLoading(false);
    }
  };

  const resetExpenseForm = () => {
    setExpenseId(null);
    setExpenseTitle('');
    setExpenseDesc('');
    setExpenseAmount('');
    setExpenseCategory('Food');
    setExpensePayer(currentUserId);
    setExpenseSplitType('equal');
    setExpenseDate(new Date().toISOString().substring(0, 16));
    setExpenseReceipt('');
    
    const initialSplits = {};
    members.forEach(m => {
      initialSplits[m.id] = { selected: true, value: '' };
    });
    setParticipantSplits(initialSplits);
  };

  // Open Edit Expense Modal
  const openEditExpense = (expense) => {
    setExpenseId(expense.id);
    setExpenseTitle(expense.title);
    setExpenseDesc(expense.description || '');
    setExpenseAmount(expense.amount.toString());
    setExpenseCategory(expense.category);
    setExpensePayer(expense.paid_by);
    
    // Find current split type
    // We can infer split type by querying splits of this expense
    const expenseSplits = splits.filter(s => s.expense_id === expense.id);
    let splitType = 'equal';
    
    if (expenseSplits.length > 0) {
      if (expenseSplits[0].shares !== null) {
        splitType = 'shares';
      } else if (expenseSplits[0].percentage !== null) {
        splitType = 'percentage';
      } else {
        // If values differ from exact equal amounts, could be exact
        // We can inspect the DB fields, wait - let's set exact or equal based on database values
        // Let's assume if both percentage and shares are null, and the amounts match, it's either equal or exact.
        // Let's check splits value fields.
        const firstAmount = parseFloat(expenseSplits[0].amount);
        const allEqual = expenseSplits.every(s => Math.abs(parseFloat(s.amount) - firstAmount) < 0.05);
        splitType = allEqual ? 'equal' : 'exact';
      }
    }

    setExpenseSplitType(splitType);
    setExpenseDate(new Date(expense.expense_date).toISOString().substring(0, 16));
    setExpenseReceipt(expense.receipt_url || '');

    // Setup participants maps
    const activeSplits = {};
    members.forEach(m => {
      const match = expenseSplits.find(es => es.user_id === m.id);
      if (match) {
        let valStr = '';
        if (splitType === 'exact') valStr = match.amount.toString();
        else if (splitType === 'percentage') valStr = match.percentage.toString();
        else if (splitType === 'shares') valStr = match.shares.toString();

        activeSplits[m.id] = { selected: true, value: valStr };
      } else {
        activeSplits[m.id] = { selected: false, value: '' };
      }
    });

    setParticipantSplits(activeSplits);
    setIsExpenseModalOpen(true);
  };

  // Delete Expense
  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    try {
      await api.delete(`/expenses/${expenseId}`);
      fetchGroupDetails();
    } catch (err) {
      alert(err.message);
    }
  };

  // Record Settlement submit
  const handleSettleSubmit = async (e) => {
    e.preventDefault();
    if (!settleTo || !settleAmount) return;
    setSettleSubmitLoading(true);
    try {
      await api.post('/settlements', {
        group_id: id,
        to_user: settleTo,
        amount: parseFloat(settleAmount),
        payment_method: settleMethod
      });
      setIsSettleModalOpen(false);
      setSettleAmount('');
      fetchGroupDetails();
    } catch (err) {
      alert(err.message);
    } finally {
      setSettleSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600 font-semibold">Error: {error}</p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-600">Group not found or you don't have access.</p>
      </div>
    );
  }

  const membership = members.find(m => m.id === currentUserId);
  const currentUserRole = membership ? membership.role : (group && group.created_by === currentUserId ? 'admin' : 'member');

  // Filter expenses list based on search and category filter
  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = exp.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          exp.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || exp.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')} 
            className="p-2 hover:bg-slate-200 rounded-xl transition text-slate-600"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <img 
              src={group?.image_url || `/placeholder-group.png`} 
              alt={group?.name || 'Group'} 
              className="w-14 h-14 rounded-2xl object-cover border border-slate-200"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{group?.name}</h2>
                <span className="text-xs font-bold py-0.5 px-2 bg-brand-50 text-brand-700 rounded-md border border-brand-100 uppercase">
                  {group?.currency}
                </span>
              </div>
              <p className="text-slate-500 text-sm mt-0.5">{group?.description || 'No description provided.'}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => { resetExpenseForm(); setIsExpenseModalOpen(true); }}
            className="flex-1 md:flex-none bg-brand-600 hover:bg-brand-500 text-white font-bold py-3 px-5 rounded-xl shadow-lg shadow-brand-500/10 flex items-center justify-center gap-2 transition"
          >
            <Plus size={18} />
            Add Expense
          </button>
          <button
            onClick={() => setIsSettleModalOpen(true)}
            className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-5 rounded-xl shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 transition"
          >
            <Coins size={18} />
            Settle Up
          </button>
          
          {currentUserRole === 'admin' && (
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="p-3 bg-slate-100 hover:bg-slate-200 rounded-xl transition text-slate-700"
              title="Add Member"
            >
              <UserPlus size={18} />
            </button>
          )}

          {currentUserRole === 'admin' && (
            <button
              onClick={async () => {
                if (!window.confirm('Are you sure you want to permanently delete this group? This cannot be undone.')) return;
                try {
                  await api.delete(`/groups/${id}`);
                  navigate('/');
                } catch (err) {
                  alert('Failed to delete group: ' + err.message);
                }
              }}
              className="p-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition text-xs font-bold px-4"
              title="Delete Group"
            >
              Delete Group
            </button>
          )}

          <button
            onClick={handleLeaveGroup}
            className="p-3 bg-rose-50 hover:bg-rose-100 rounded-xl transition text-rose-600 text-xs font-bold px-4"
          >
            Leave Group
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Ledger logs */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Filters Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-3 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search expense titles..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500 text-sm"
              />
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full md:w-44 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500 text-sm"
              >
                <option value="All">All Categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Ledger lists */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 text-lg mb-4">Transaction Ledger</h3>

            {filteredExpenses.length === 0 && settlements.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Info className="mx-auto mb-2 text-slate-300" size={36} />
                <p className="font-semibold text-sm">No transactions logged yet</p>
                <p className="text-xs mt-1">Add expenses or record settlements to start tracking ledger balances.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Ledger items */}
                {filteredExpenses.map(exp => {
                  const payerName = members.find(m => m.id === exp.paid_by)?.full_name || 'Someone';
                  
                  // user share
                  const userSplit = splits.find(s => s.expense_id === exp.id && s.user_id === currentUserId);
                  const isPayer = exp.paid_by === currentUserId;

                  return (
                    <div 
                      key={exp.id} 
                      className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-sm shrink-0 uppercase">
                          {exp.category.substring(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 text-sm truncate">{exp.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Paid by <span className="font-semibold text-slate-700">{payerName}</span> • {new Date(exp.expense_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-extrabold text-slate-800">{group.currency} {parseFloat(exp.amount).toFixed(2)}</p>
                          {userSplit ? (
                            <p className={`text-[11px] font-semibold mt-0.5 ${isPayer ? 'text-emerald-600' : 'text-rose-500'}`}>
                              {isPayer ? `You lent ${group.currency} ${(parseFloat(exp.amount) - parseFloat(userSplit.amount)).toFixed(2)}` : `You owe ${group.currency} ${parseFloat(userSplit.amount).toFixed(2)}`}
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-400 mt-0.5">Not involved</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 border-l border-slate-100 pl-3">
                          <button 
                            onClick={() => openEditExpense(exp)} 
                            className="p-1.5 text-slate-400 hover:text-brand-600 rounded-md hover:bg-slate-100"
                            title="Edit"
                          >
                            <Settings size={14} />
                          </button>
                          <button 
                            onClick={() => handleDeleteExpense(exp.id)} 
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-100"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Settlement log rows */}
                {settlements.map(set => {
                  const fromName = members.find(m => m.id === set.from_user)?.full_name || 'Someone';
                  const toName = members.find(m => m.id === set.to_user)?.full_name || 'Someone';

                  return (
                    <div 
                      key={set.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-emerald-50/20 border border-emerald-100/50"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <Coins size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            <span className="font-bold">{fromName}</span> paid <span className="font-bold">{toName}</span>
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Recorded via {set.payment_method} • {new Date(set.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="text-right pr-1">
                        <p className="text-sm font-extrabold text-emerald-700">
                          +{group.currency} {parseFloat(set.amount).toFixed(2)}
                        </p>
                        <span className="inline-block text-[9px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full mt-1">
                          {set.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Balances and simplified transfers */}
        <div className="space-y-6">
          
          {/* Member Balance sheet */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 text-lg mb-4">Member Balances</h3>
            <div className="space-y-3">
              {balances.map(b => (
                <div key={b.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-50 bg-slate-50/40">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs shrink-0 text-slate-600">
                      {getInitials(b.full_name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-xs truncate">{b.full_name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{b.email}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className={`text-xs font-extrabold ${b.net > 0.01 ? 'text-emerald-600' : b.net < -0.01 ? 'text-rose-500' : 'text-slate-500'}`}>
                      {b.net > 0.01 ? `+${group.currency} ${b.net.toFixed(2)}` : b.net < -0.01 ? `-${group.currency} ${Math.abs(b.net).toFixed(2)}` : 'Settled'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Simplified Debts */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-bold text-slate-800 text-lg">Simplified Debts</h3>
              <span className="text-[10px] font-bold text-brand-600 bg-brand-50 border border-brand-100 py-0.5 px-2 rounded-full flex items-center gap-0.5">
                <Sparkles size={10} /> Smart Settle
              </span>
            </div>
            
            {simplifiedDebts.length === 0 ? (
              <p className="text-slate-400 text-xs py-4 text-center">Everyone is settled up! No debts outstanding.</p>
            ) : (
              <div className="space-y-3">
                {simplifiedDebts.map((debt, index) => (
                  <div key={index} className="p-3.5 border border-slate-100 rounded-xl bg-slate-50/30 text-xs space-y-2">
                    <p className="text-slate-600">
                      <span className="font-bold text-slate-800">{debt.from_name}</span> owes <span className="font-bold text-slate-800">{debt.to_name}</span>
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-sm text-slate-800">{group.currency} {debt.amount.toFixed(2)}</span>
                      {debt.from === currentUserId && (
                        <button
                          onClick={() => {
                            setSettleFrom(debt.from);
                            setSettleTo(debt.to);
                            setSettleAmount(debt.amount.toString());
                            setIsSettleModalOpen(true);
                          }}
                          className="py-1 px-2.5 bg-brand-600 text-white rounded-md font-bold text-[10px] hover:bg-brand-500 transition"
                        >
                          Pay debt
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Member admin lists */}
          {currentUserRole === 'admin' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 text-lg mb-4">Manage Members</h3>
              <div className="space-y-3">
                {members.map(member => (
                  <div key={member.id} className="flex items-center justify-between text-xs py-2 border-b border-slate-50 last:border-0">
                    <div>
                      <p className="font-bold text-slate-800">{member.full_name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 capitalize">{member.role}</p>
                    </div>
                    
                    {member.id !== currentUserId && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handlePromoteRole(member.id, member.role)}
                          className="py-1 px-2 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-semibold"
                        >
                          Toggle Admin
                        </button>
                        <button
                          onClick={() => handleRemoveMember(member.id, member.full_name)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                          title="Remove Member"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <h3 className="text-xl font-extrabold text-slate-900">{expenseId ? 'Edit Expense' : 'Add Expense'}</h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleExpenseSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Title</label>
                  <input
                    type="text"
                    required
                    value={expenseTitle}
                    onChange={(e) => setExpenseTitle(e.target.value)}
                    placeholder="e.g. Dinner party, Gas bill"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-500 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-500 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Category</label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Date</label>
                  <input
                    type="datetime-local"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-500 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Paid By</label>
                  <select
                    value={expensePayer}
                    onChange={(e) => setExpensePayer(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
                  >
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.full_name} {m.id === currentUserId ? '(You)' : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Split Type</label>
                  <select
                    value={expenseSplitType}
                    onChange={(e) => setExpenseSplitType(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
                  >
                    <option value="equal">Split Equally</option>
                    <option value="exact">Exact Amounts</option>
                    <option value="percentage">Percentages (%)</option>
                    <option value="shares">Shares Ratio</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description / Notes</label>
                <input
                  type="text"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder="Notes (optional)"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-500 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Receipt Image URL</label>
                <input
                  type="url"
                  value={expenseReceipt}
                  onChange={(e) => setExpenseReceipt(e.target.value)}
                  placeholder="https://example.com/receipt.jpg (optional)"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-500 outline-none text-sm"
                />
              </div>

              {/* Dynamic Split Participant Inputs */}
              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Split Details</span>
                
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {members.map(member => {
                    const status = participantSplits[member.id] || { selected: true, value: '' };
                    return (
                      <div key={member.id} className="flex items-center justify-between text-xs">
                        <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 min-w-0">
                          <input
                            type="checkbox"
                            checked={status.selected}
                            onChange={(e) => setParticipantSplits({
                              ...participantSplits,
                              [member.id]: { ...status, selected: e.target.checked }
                            })}
                            className="w-4 h-4 rounded text-brand-600"
                          />
                          <span className="truncate">{member.full_name}</span>
                        </label>

                        {status.selected && expenseSplitType !== 'equal' && (
                          <div className="flex items-center gap-2 shrink-0">
                            <input
                              type="number"
                              step={expenseSplitType === 'exact' ? '0.01' : '1'}
                              value={status.value}
                              required
                              onChange={(e) => setParticipantSplits({
                                ...participantSplits,
                                [member.id]: { ...status, value: e.target.value }
                              })}
                              placeholder={expenseSplitType === 'exact' ? '0.00' : expenseSplitType === 'percentage' ? '%' : 'shares'}
                              className="w-24 px-2 py-1.5 bg-white border border-slate-200 rounded text-right outline-none focus:border-brand-500"
                            />
                            <span className="text-slate-400 font-bold w-6">
                              {expenseSplitType === 'exact' ? group.currency : expenseSplitType === 'percentage' ? '%' : 'sh'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={expenseSubmitLoading}
                  className="flex-1 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold text-sm transition disabled:opacity-50"
                >
                  {expenseSubmitLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Up Modal */}
      {isSettleModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <h3 className="text-xl font-extrabold text-slate-900">Record Settlement</h3>
              <button onClick={() => setIsSettleModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSettleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">From User (Payer)</label>
                <select
                  value={settleFrom}
                  onChange={(e) => setSettleFrom(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
                >
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.full_name} {m.id === currentUserId ? '(You)' : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">To User (Payee)</label>
                <select
                  value={settleTo}
                  onChange={(e) => setSettleTo(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
                >
                  {members.filter(m => m.id !== settleFrom).map(m => (
                    <option key={m.id} value={m.id}>{m.full_name} {m.id === currentUserId ? '(You)' : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Settlement Amount</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-500 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Payment Channel</label>
                <select
                  value={settleMethod}
                  onChange={(e) => setSettleMethod(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSettleModalOpen(false)}
                  className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settleSubmitLoading}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm transition disabled:opacity-50"
                >
                  {settleSubmitLoading ? 'Saving...' : 'Confirm Settle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <h3 className="text-xl font-extrabold text-slate-900">Add Group Member</h3>
              <button onClick={() => setIsInviteModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Member Email Address</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="roommate@example.com"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-500 outline-none text-sm"
                />
              </div>

              <p className="text-[10px] text-slate-400 mt-1">
                If the email exists in our system, they will be added immediately. Otherwise, an invitation email will be sent!
              </p>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="flex-1 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold text-sm transition disabled:opacity-50"
                >
                  {inviteLoading ? 'Sending...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
