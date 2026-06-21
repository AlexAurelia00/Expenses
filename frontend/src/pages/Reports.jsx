import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { 
  FileText, 
  Table, 
  Download, 
  Calendar, 
  Grid, 
  Filter, 
  DollarSign, 
  BarChart,
  ChevronRight
} from 'lucide-react';
import { 
  BarChart as RechartsBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

const CATEGORIES = ['Food', 'Travel', 'Shopping', 'Rent', 'Utilities', 'Healthcare', 'Education', 'Entertainment', 'Other'];
const COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6', '#6366f1', '#64748b'];

export default function Reports({ userSession }) {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  
  const [analytics, setAnalytics] = useState({
    totalExpenses: 0,
    userShare: 0,
    monthlyTrend: [],
    categoryDistribution: []
  });
  
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState({ pdf: false, excel: false, csv: false });

  const fetchFiltersAndData = async () => {
    setLoading(true);
    try {
      const groupsData = await api.get('/groups');
      setGroups(groupsData);

      // Build summary params
      const params = new URLSearchParams();
      if (selectedGroup) params.append('group_id', selectedGroup);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const summaryData = await api.get(`/reports/summary?${params.toString()}`);
      setAnalytics(summaryData);
    } catch (err) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiltersAndData();
  }, [selectedGroup, startDate, endDate]);

  const handleExport = async (format) => {
    setExportLoading({ ...exportLoading, [format]: true });
    try {
      const params = new URLSearchParams();
      if (selectedGroup) params.append('group_id', selectedGroup);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const filename = `Expense_Report_${Date.now()}.${format === 'excel' ? 'xlsx' : format}`;
      await api.download(`/reports/export/${format}?${params.toString()}`, filename);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExportLoading({ ...exportLoading, [format]: false });
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Reports & Analytics</h2>
        <p className="text-slate-500 mt-1">Export transaction histories and analyze spending patterns.</p>
      </div>

      {/* Filter panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-1.5">
          <Filter size={16} /> Filters
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Select Group */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Group ledger</label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500 text-sm"
            >
              <option value="">All Groups</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500 text-sm"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500 text-sm"
            />
          </div>

          {/* Export Downloads */}
          <div className="sm:col-span-2 md:col-span-3 lg:col-span-1 flex flex-col justify-end">
            <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 hidden lg:block">Action</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleExport('pdf')}
                disabled={exportLoading.pdf}
                className="py-2.5 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border border-brand-100 disabled:opacity-50"
              >
                <Download size={14} /> PDF
              </button>
              <button
                onClick={() => handleExport('excel')}
                disabled={exportLoading.excel}
                className="py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border border-emerald-100 disabled:opacity-50"
              >
                <Download size={14} /> Excel
              </button>
              <button
                onClick={() => handleExport('csv')}
                disabled={exportLoading.csv}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border border-slate-200 disabled:opacity-50"
              >
                <Download size={14} /> CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: summary indicators + details */}
          <div className="lg:col-span-1 space-y-6">
            
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filtered Spend</span>
                <h3 className="text-2xl font-extrabold text-slate-800 mt-1">
                  ${analytics.totalExpenses.toFixed(2)}
                </h3>
              </div>
              <div className="bg-brand-50 text-brand-600 p-3 rounded-xl">
                <DollarSign size={20} />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filtered Your Share</span>
                <h3 className="text-2xl font-extrabold text-slate-800 mt-1">
                  ${analytics.userShare.toFixed(2)}
                </h3>
              </div>
              <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
                <BarChart size={20} />
              </div>
            </div>

            {/* Category summary cards list */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 text-sm mb-4">Category Expenditures</h3>
              {analytics.categoryDistribution.length === 0 ? (
                <p className="text-slate-400 text-xs py-2">No category details found.</p>
              ) : (
                <div className="space-y-3">
                  {analytics.categoryDistribution.map((item, index) => (
                    <div key={item.category} className="flex items-center justify-between text-xs pb-2 border-b border-slate-50 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                        <span className="text-slate-600 font-semibold">{item.category}</span>
                      </div>
                      <span className="text-slate-800 font-bold">${item.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: charts */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[380px]">
            <h3 className="font-bold text-slate-800 text-sm mb-4">Category distribution</h3>
            <div className="flex-1 min-h-[300px]">
              {analytics.categoryDistribution.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  Not enough spending logs to render chart.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={analytics.categoryDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="category" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="amount" fill="#8b5cf6" radius={[6, 6, 0, 0]}>
                      {analytics.categoryDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </RechartsBarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
