import React, { useState } from 'react';
import { supabase } from '../services/api.js';
import { Mail, Lock, User, Phone, Wallet, AlertCircle, ArrowRight } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (isForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/profile`,
        });
        if (error) throw error;
        setMessage('Password reset link sent! Check your email inbox.');
      } else if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              mobile: mobile,
            }
          }
        });
        if (error) throw error;
        
        if (data?.user?.identities?.length === 0) {
          setError('This email is already registered. Try logging in.');
        } else {
          setMessage('Registration successful! Please check your email to verify your account.');
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background blobs for modern dark aesthetic */}
      <div className="absolute top-[-20%] left-[-10%] w-96 h-96 rounded-full bg-brand-900/30 blur-3xl"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 rounded-full bg-emerald-900/20 blur-3xl"></div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-brand-500 p-3 rounded-2xl text-white shadow-xl shadow-brand-500/30 mb-3">
            <Wallet size={32} />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            SplitWise
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {isForgotPassword ? 'Reset password' : isLogin ? 'Sign in to split expenses' : 'Create an account to share ledger'}
          </p>
        </div>

        {error && (
          <div className="bg-rose-900/20 border border-rose-800 text-rose-300 px-4 py-3 rounded-xl flex items-start gap-3 mb-6 text-sm">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="bg-emerald-900/20 border border-emerald-800 text-emerald-300 px-4 py-3 rounded-xl flex items-start gap-3 mb-6 text-sm">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <span>{message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && !isForgotPassword && (
            <>
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Full Name</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                    <User size={18} />
                  </span>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 text-white rounded-xl focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-sm transition"
                  />
                </div>
              </div>

              {/* Mobile */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Mobile Number</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                    <Phone size={18} />
                  </span>
                  <input
                    type="tel"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 text-white rounded-xl focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-sm transition"
                  />
                </div>
              </div>
            </>
          )}

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Email Address</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <Mail size={18} />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 text-white rounded-xl focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-sm transition"
              />
            </div>
          </div>

          {/* Password */}
          {!isForgotPassword && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">Password</label>
                {isLogin && (
                  <button 
                    type="button"
                    onClick={() => { setIsForgotPassword(true); setError(null); setMessage(null); }}
                    className="text-xs text-brand-400 hover:text-brand-300 font-semibold"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                  <Lock size={18} />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 text-white rounded-xl focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-sm transition"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 text-white rounded-xl font-bold text-sm shadow-xl shadow-brand-600/35 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? 'Processing...' : isForgotPassword ? 'Send Reset Link' : isLogin ? 'Sign In' : 'Create Account'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        {/* Footer Switches */}
        <div className="mt-8 text-center text-sm text-slate-400">
          {isForgotPassword ? (
            <button
              onClick={() => { setIsForgotPassword(false); setIsLogin(true); setError(null); setMessage(null); }}
              className="text-brand-400 hover:text-brand-300 font-bold"
            >
              Back to Login
            </button>
          ) : isLogin ? (
            <>
              Don't have an account?{' '}
              <button
                onClick={() => { setIsLogin(false); setError(null); setMessage(null); }}
                className="text-brand-400 hover:text-brand-300 font-bold"
              >
                Sign Up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                onClick={() => { setIsLogin(true); setError(null); setMessage(null); }}
                className="text-brand-400 hover:text-brand-300 font-bold"
              >
                Log In
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
