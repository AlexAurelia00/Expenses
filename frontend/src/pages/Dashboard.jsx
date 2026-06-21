import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  ChevronRight, 
  Trash2,
  PieChart as PieIcon, 
  Grid, 
  DollarSign, 
  Briefcase,
  Users,
  Compass
} from 'lucide-react';

import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Cell,
  Pie
} from 'recharts';

const COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6', '#6366f1', '#64748b'];

export default function Dashboard({ userSession }) {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [summary, setSummary] = useState({
    totalExpenses: 0,
    userShare: 0,
    monthlyTrend: [],
    categoryDistribution: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Group Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupCurrency, setGroupCurrency] = useState('USD');
  const [groupImage, setGroupImage] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const groupsData = await api.get('/groups');
      setGroups(groupsData);

      const summaryData = await api.get('/reports/summary');
      setSummary(summaryData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName) return;
    setCreateLoading(true);
    try {
      const payload = {
        name: groupName,
        description: groupDesc,
        image_url: groupImage || 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?q=80&w=250&auto=format&fit=crop',
        currency: groupCurrency
      };
      const newGroup = await api.post('/groups', payload);
      setGroups([newGroup, ...groups]);
      setIsModalOpen(false);
      // reset
      setGroupName('');
      setGroupDesc('');
      setGroupImage('');
      setGroupCurrency('USD');
      navigate(`/groups/${newGroup.id}`);
    } catch (err) {
      alert('Failed to create group: ' + err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  // Calculate Net Balances
  // We can sum balances if they are fetched per group, but summary provides overall user share.
  // Let's create visual cards for dashboard
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Welcome back, {userSession.user.user_metadata?.full_name || 'User'}!
          </h2>
          <p className="text-slate-500 mt-1">Here is a quick overview of your split balances and expenses.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-brand-600 hover:bg-brand-500 text-white font-bold py-3 px-5 rounded-xl shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 transition active:scale-95 shrink-0"
        >
          <Plus size={18} />
          Create Group
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card 1: Total Group Spend */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Group Spending</span>
            <h3 className="text-2xl font-extrabold text-slate-800 mt-1">
              ${summary.totalExpenses.toFixed(2)}
            </h3>
            <p className="text-xs text-slate-500 mt-1">Across all your groups</p>
          </div>
          <div className="bg-brand-50 text-brand-600 p-3 rounded-xl">
            <DollarSign size={24} />
          </div>
        </div>

        {/* Card 2: Your Share */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Your Personal Share</span>
            <h3 className="text-2xl font-extrabold text-slate-800 mt-1">
              ${summary.userShare.toFixed(2)}
            </h3>
            <p className="text-xs text-slate-500 mt-1">Amount you personally spent</p>
          </div>
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
            <TrendingUp size={24} />
          </div>
        </div>

        {/* Card 3: Active Groups */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Shared Groups</span>
            <h3 className="text-2xl font-extrabold text-slate-800 mt-1">
              {groups.length}
            </h3>
            <p className="text-xs text-slate-500 mt-1">Group ledgers active</p>
          </div>
          <div className="bg-purple-50 text-purple-600 p-3 rounded-xl">
            <Users size={24} />
          </div>
        </div>
      </div>

      {/* Main Grid: Groups + Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Groups Column */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col h-[520px]">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <h3 className="font-bold text-slate-800 text-lg">My Groups</h3>
            <span className="text-xs font-semibold bg-slate-100 text-slate-600 py-1 px-2.5 rounded-full">{groups.length} total</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {groups.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <Compass className="text-slate-300 mb-2" size={40} />
                <p className="text-slate-500 text-sm font-semibold">No groups found</p>
                <p className="text-slate-400 text-xs mt-1">Create a group to start sharing expenses with friends.</p>
              </div>
            ) : (
              groups.map(group => (
                <div 
                  key={group.id}
                  onClick={() => navigate(`/groups/${group.id}`)}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 hover:border-brand-200 hover:bg-brand-50/20 cursor-pointer transition group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img 
                      src={group.image_url} 
                      alt={group.name} 
                      className="w-11 h-11 rounded-xl object-cover shrink-0 bg-slate-100"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-sm group-hover:text-brand-700 transition truncate">{group.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{group.description || 'No description'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold uppercase py-0.5 px-2 bg-slate-100 text-slate-600 rounded-md">
                      {group.currency}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!window.confirm('Delete this group? This action is permanent.')) return;
                        (async () => {
                          try {
                            await api.delete(`/groups/${group.id}`);
                            // remove locally
                            setGroups(prev => prev.filter(g => g.id !== group.id));
                          } catch (err) {
                            alert('Failed to delete group: ' + err.message);
                          }
                        })();
                      }}
                      title="Delete Group"
                      className="p-2 text-rose-500 hover:text-white hover:bg-rose-500 rounded-md"
                    >
                      <Trash2 size={16} />
                    </button>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-brand-500 transition" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Charts Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Monthly Spending Trend */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 text-lg mb-4">Monthly Spending Trend</h3>
            <div className="h-64">
              {summary.monthlyTrend.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  Not enough transaction logs to render chart.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={summary.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip contentStyle={{ borderRadius: '12px', borderColor: '#e2e8f0' }} />
                    <Line type="monotone" dataKey="amount" stroke="#8b5cf6" strokeWidth={3} activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Category Distribution Chart */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 text-lg mb-4">Category Distribution</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-6">
              <div className="h-48">
                {summary.categoryDistribution.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                    No data.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={summary.categoryDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="amount"
                      >
                        {summary.categoryDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="space-y-2">
                {summary.categoryDistribution.map((entry, index) => (
                  <div key={entry.category} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                      <span className="text-slate-600 font-semibold">{entry.category}</span>
                    </div>
                    <span className="text-slate-800 font-bold">${entry.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Group Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-extrabold text-slate-900 mb-1">Create Shared Group</h3>
            <p className="text-xs text-slate-500 mb-6">Group ledgers let you splits bills with roommates, trips, or family.</p>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Group Name</label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Summer Vacation, Roommates"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-sm transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</label>
                <textarea
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  placeholder="What is this group for?"
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-sm transition resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Currency</label>
                  <select
                    value={groupCurrency}
                    onChange={(e) => setGroupCurrency(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-500 outline-none text-sm transition"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="JPY">JPY (¥)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Group Image URL</label>
                  <input
                    type="url"
                    value={groupImage}
                    onChange={(e) => setGroupImage(e.target.value)}
                    placeholder="URL (optional)"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-sm transition"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex-1 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold text-sm transition disabled:opacity-50 shadow-lg shadow-brand-500/10"
                >
                  {createLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
