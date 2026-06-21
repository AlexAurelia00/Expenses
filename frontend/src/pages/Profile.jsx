import React, { useState, useEffect } from 'react';
import { supabase, api } from '../services/api.js';
import { User, Phone, Mail, Lock, ShieldAlert, Upload, Trash2, Camera } from 'lucide-react';

export default function Profile({ userSession }) {
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [updateLoading, setUpdateLoading] = useState(false);

  // Password fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Account delete fields
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchProfile = async () => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userSession.user.id)
        .single();

      if (error) throw error;

      setFullName(profile.full_name || '');
      setMobile(profile.mobile || '');
      setAvatarUrl(profile.avatar_url || '');
      setEmail(profile.email || userSession.user.email);
    } catch (err) {
      console.error('Failed to load profile:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [userSession]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setUpdateLoading(true);
    try {
      await api.put('/users/me', {
        full_name: fullName,
        mobile,
        avatar_url: avatarUrl
      });
      
      // Update local supabase user metadata in parallel if needed
      await supabase.auth.updateUser({
        data: { full_name: fullName, mobile: mobile }
      });

      alert('Profile updated successfully!');
    } catch (err) {
      alert('Update failed: ' + err.message);
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userSession.user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload file to Supabase storage bucket 'avatars'
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
      
      // Save URL to profile record
      await api.put('/users/me', { avatar_url: publicUrl });
      alert('Avatar uploaded and updated successfully!');
    } catch (err) {
      alert(
        'Storage upload failed: ' + err.message + 
        '\n\nNote: Please verify that you have created a public bucket named "avatars" in your Supabase project.'
      );
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match.');
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      alert('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      alert('Password update failed: ' + err.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm(
      'WARNING: Are you sure you want to delete your account permanently? This action CANNOT be undone. ' +
      'Make sure you have settled all balances in all groups!'
    )) return;

    setDeleteLoading(true);
    try {
      const response = await api.delete('/users/me');
      alert(response.message || 'Account deleted successfully.');
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">My Profile Settings</h2>
        <p className="text-slate-500 mt-1">Manage your account information, security credentials, and preferences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Column: Avatar upload */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col items-center text-center">
            <div className="relative group">
              <img
                src={avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop'}
                alt="Avatar"
                className="w-32 h-32 rounded-full object-cover border-4 border-slate-100 shadow-md bg-slate-100"
              />
              <label className="absolute bottom-1 right-1 bg-brand-600 hover:bg-brand-500 text-white p-2.5 rounded-full cursor-pointer shadow-lg transition active:scale-95">
                <Camera size={16} />
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleAvatarUpload}
                  className="hidden" 
                />
              </label>
            </div>
            
            <h4 className="font-bold text-slate-800 text-base mt-4">{fullName || 'User'}</h4>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-full">{email}</p>
            <p className="text-[10px] text-slate-400 mt-2 bg-slate-50 border border-slate-200 px-3 py-1 rounded-full">
              ID: {userSession.user.id.substring(0, 8)}...
            </p>
          </div>
        </div>

        {/* Right Column: Profile Form + Security Settings */}
        <div className="md:col-span-2 space-y-8">
          
          {/* Profile details */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 text-lg mb-6 flex items-center gap-1.5 border-b border-slate-100 pb-3">
              <User size={18} className="text-brand-600" /> Personal details
            </h3>

            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-500 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Mobile Number</label>
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-500 outline-none text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address (Read Only)</label>
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-400 text-sm cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Avatar URL</label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="Paste direct image URL"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-500 outline-none text-sm text-xs"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={updateLoading}
                  className="py-3 px-6 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold text-sm transition disabled:opacity-50"
                >
                  {updateLoading ? 'Saving...' : 'Save Profile Details'}
                </button>
              </div>
            </form>
          </div>

          {/* Change Password */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 text-lg mb-6 flex items-center gap-1.5 border-b border-slate-100 pb-3">
              <Lock size={18} className="text-brand-600" /> Security
            </h3>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">New Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-500 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-500 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="py-3 px-6 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition disabled:opacity-50"
                >
                  {passwordLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>

          {/* Danger zone: Delete Account */}
          <div className="bg-rose-50/50 border border-rose-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-rose-800 text-lg mb-2 flex items-center gap-1.5">
              <ShieldAlert size={20} className="text-rose-600" /> Danger Zone
            </h3>
            <p className="text-xs text-rose-600 mb-6">
              Deleting your account is permanent. It will instantly delete your credentials, profile logs, splits, and memberships.
              You will not be able to delete your account if you have outstanding group balances.
            </p>

            <button
              onClick={handleDeleteAccount}
              disabled={deleteLoading}
              className="py-3 px-6 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-sm transition flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-lg shadow-rose-600/10"
            >
              <Trash2 size={16} />
              {deleteLoading ? 'Deleting...' : 'Delete My Account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
