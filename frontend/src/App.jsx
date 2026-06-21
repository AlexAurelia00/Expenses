import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams, Navigate } from 'react-router-dom';
import { supabase, api } from './services/api.js';
import { 
  LayoutDashboard, 
  Users, 
  FileBarChart2, 
  User, 
  LogOut, 
  Bell, 
  Wallet, 
  Menu, 
  X,
  CreditCard,
  TrendingDown,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';

import Dashboard from './pages/Dashboard.jsx';
import GroupDetails from './pages/GroupDetails.jsx';
import Reports from './pages/Reports.jsx';
import Profile from './pages/Profile.jsx';
import Auth from './pages/Auth.jsx';

function AppContent() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch in-app notifications if logged in
  const fetchNotifications = async () => {
    if (!session) return;
    try {
      const data = await api.get('/notifications');
      setNotifications(data);
    } catch (err) {
      console.error('Failed to load notifications:', err.message);
    }
  };

  useEffect(() => {
    if (session) {
      fetchNotifications();
      // Poll notifications every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [session]);

  const markAllNotificationsRead = async () => {
    try {
      await api.patch('/notifications/all/read', {});
      fetchNotifications();
    } catch (err) {
      console.error(err.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white p-6 border-r border-slate-800">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-brand-500 p-2 rounded-lg text-white shadow-lg shadow-brand-500/30">
            <Wallet size={24} />
          </div>
          <div>
            <h1 className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-brand-300 to-white bg-clip-text text-transparent">
              SplitWise
            </h1>
            <p className="text-xs text-slate-400">Smart Expense Sharing</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          <Link to="/" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition text-slate-300 hover:text-white font-medium">
            <LayoutDashboard size={20} />
            Dashboard
          </Link>
          <Link to="/reports" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition text-slate-300 hover:text-white font-medium">
            <FileBarChart2 size={20} />
            Reports & Analytics
          </Link>
          <Link to="/profile" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition text-slate-300 hover:text-white font-medium">
            <User size={20} />
            My Profile
          </Link>
        </nav>

        <div className="pt-6 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-brand-300">
              {session.user.user_metadata?.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate">{session.user.user_metadata?.full_name || 'User'}</p>
              <p className="text-xs text-slate-400 truncate">{session.user.email}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/50 hover:bg-rose-900/30 text-slate-300 hover:text-rose-200 transition font-medium"
          >
            <LogOut size={20} />
            Log Out
          </button>
        </div>
      </aside>

      {/* Mobile Top Navigation */}
      <header className="md:hidden flex items-center justify-between bg-slate-900 text-white px-6 py-4 border-b border-slate-800 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <Wallet className="text-brand-500" size={24} />
          <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-brand-300 to-white bg-clip-text text-transparent">
            SplitWise
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowNotifications(!showNotifications)} 
            className="relative p-1 text-slate-400 hover:text-white"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-slate-400 hover:text-white"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Panel */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-[60px] bg-slate-900 text-white z-30 border-b border-slate-800 shadow-xl p-6 space-y-4">
          <nav className="flex flex-col gap-2">
            <Link to="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-2 text-slate-300">
              <LayoutDashboard size={20} /> Dashboard
            </Link>
            <Link to="/reports" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-2 text-slate-300">
              <FileBarChart2 size={20} /> Reports & Analytics
            </Link>
            <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-2 text-slate-300">
              <User size={20} /> My Profile
            </Link>
          </nav>
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-brand-300 text-sm">
                {session.user.user_metadata?.full_name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="text-sm font-semibold truncate">{session.user.user_metadata?.full_name || 'User'}</span>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-1 text-sm text-rose-400 hover:text-rose-200">
              <LogOut size={16} /> Log Out
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto relative">
        {/* Desktop Header bar */}
        <header className="hidden md:flex items-center justify-between bg-white px-8 py-4 border-b border-slate-200 sticky top-0 z-20">
          <div className="text-slate-500 font-medium text-sm">
            Current Session: <span className="text-slate-900 font-semibold">{session.user.email}</span>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Notification Bell */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-slate-500 hover:text-brand-600 rounded-full hover:bg-slate-100 transition relative"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4.5 h-4.5 bg-rose-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center ring-2 ring-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-3 overflow-hidden">
                  <div className="px-4 pb-2 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-sm">In-App Notifications</span>
                    {unreadCount > 0 && (
                      <button 
                        onClick={markAllNotificationsRead}
                        className="text-xs text-brand-600 hover:underline font-semibold"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-xs text-slate-400">
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.map(notification => (
                        <div 
                          key={notification.id} 
                          className={`px-4 py-3 border-b border-slate-50 text-xs transition ${notification.is_read ? 'opacity-70' : 'bg-brand-50/40'}`}
                        >
                          <p className="font-bold text-slate-800">{notification.title}</p>
                          <p className="text-slate-500 mt-0.5">{notification.message}</p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {new Date(notification.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="h-6 w-px bg-slate-200"></div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">{session.user.user_metadata?.full_name || 'My Profile'}</span>
            </div>
          </div>
        </header>

        {/* Dynamic Route Pages */}
        <div className="flex-1 p-6 md:p-8">
          <Routes>
            <Route path="/" element={<Dashboard userSession={session} />} />
            <Route path="/groups/:id" element={<GroupDetails userSession={session} />} />
            <Route path="/reports" element={<Reports userSession={session} />} />
            <Route path="/profile" element={<Profile userSession={session} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
