'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { UserPlusIcon, EnvelopeIcon, UserIcon, ArrowLeftIcon, ArrowPathIcon, UserGroupIcon, IdentificationIcon, CalendarIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

type PlatformUser = {
  id: string;
  email: string;
  name: string;
  created_at: string;
  last_sign_in_at: string | null;
  role: string;
};

export default function UserManagement() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [resettingUser, setResettingUser] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const response = await fetch('/api/admin/users');
      const data = await response.json();
      if (response.ok) {
        setUsers(data.users || []);
        setUsersError(null);
      } else {
        setUsersError(data.error || `Error ${response.status}: Failed to load users`);
      }
    } catch (err: any) {
      setUsersError(err.message || 'Network error fetching users');
      console.error('Failed to fetch users:', err);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
        const response = await fetch('/api/admin/invite-user', {
            method: 'POST',
            body: JSON.stringify({ email, name }),
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (response.ok) {
            setMessage({ type: 'success', text: `Invitation sent to ${email}!` });
            setEmail('');
            setName('');
            fetchUsers();
        } else {
            setMessage({ type: 'error', text: data.error || 'Failed to send invitation' });
        }
    } catch (err: any) {
        setMessage({ type: 'error', text: err.message || 'An unexpected error occurred' });
    } finally {
        setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newPassword) return;
    setResettingUser(selectedUser.id);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        body: JSON.stringify({ userId: selectedUser.id, newPassword }),
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: `Password for ${selectedUser.name} has been updated.` });
        setShowResetModal(false);
        setNewPassword('');
        setSelectedUser(null);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to reset password' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'An unexpected error occurred' });
    } finally {
      setResettingUser(null);
    }
  };

  const openResetModal = (user: PlatformUser) => {
    setSelectedUser(user);
    setShowResetModal(true);
    setNewPassword('');
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-12 pb-24 px-6">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex items-center gap-4 mb-10">
            <Link href="/admin" className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-slate-200">
                <ArrowLeftIcon className="h-5 w-5 text-slate-500" />
            </Link>
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">User Management</h1>
                <p className="text-slate-500 font-medium">Add and manage platform team members</p>
            </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-10">
          
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 h-fit sticky top-24">
              <div className="inline-flex items-center gap-2 p-3 bg-indigo-50 rounded-2xl mb-6 border border-indigo-100">
                <div className="bg-white p-1.5 rounded-lg shadow-sm text-indigo-600">
                  <UserPlusIcon className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-indigo-900 uppercase tracking-wide px-1">Invite Member</span>
              </div>

              <form onSubmit={handleAddUser} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Full Name</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-black transition-colors">
                      <UserIcon className="h-4 w-4" />
                    </div>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      type="text"
                      required
                      className="block w-full pl-10 pr-4 py-3 bg-slate-50 border-transparent border focus:border-black focus:bg-white rounded-xl text-sm transition-all duration-200 outline-none placeholder:text-slate-300"
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Email Address</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-black transition-colors">
                      <EnvelopeIcon className="h-4 w-4" />
                    </div>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      required
                      className="block w-full pl-10 pr-4 py-3 bg-slate-50 border-transparent border focus:border-black focus:bg-white rounded-xl text-sm transition-all duration-200 outline-none placeholder:text-slate-300"
                      placeholder="name@company.com"
                    />
                  </div>
                </div>

                {message && (
                  <div className={`p-3 rounded-xl text-[10px] font-bold animate-in fade-in duration-300 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                    {message.type === 'success' ? '✅' : '⚠️'} {message.text}
                  </div>
                )}

                <button
                  disabled={loading}
                  type="submit"
                  className="w-full bg-black hover:bg-zinc-800 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-black/5 active:scale-[0.98] disabled:opacity-50 text-xs"
                >
                  {loading ? (
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  ) : (
                      <>Send Invite <UserPlusIcon className="h-4 w-4" /></>
                  )}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-slate-100 p-2 rounded-xl text-slate-600">
                    <UserGroupIcon className="h-5 w-5" />
                  </div>
                  <h2 className="font-bold text-slate-900">Current Users</h2>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                  {users.length} Total
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">User Details</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Role</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Signed In</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {usersLoading ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-300">
                          <ArrowPathIcon className="h-6 w-6 animate-spin mx-auto mb-2" />
                          <span className="text-xs font-medium">Fetching member list...</span>
                        </td>
                      </tr>
                    ) : usersError ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center">
                          <div className="inline-flex flex-col items-center gap-2">
                            <span className="text-xs font-bold text-red-600">⚠️ {usersError}</span>
                            <button onClick={fetchUsers} className="text-[10px] font-bold text-indigo-600 hover:underline">Retry</button>
                          </div>
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic text-xs">
                          No users found on platform.
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user.id} className="group hover:bg-slate-50/50 transition-all duration-200">
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm group-hover:bg-white group-hover:shadow-sm transition-all border border-transparent group-hover:border-slate-100">
                                {user.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-sm font-bold text-slate-900">{user.name}</div>
                                <div className="text-[11px] text-slate-400 font-medium">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg border ${
                              user.role === 'super_admin' || user.email.endsWith('@lnkd.ai')
                                ? 'bg-indigo-50 text-indigo-600 border-indigo-100'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              <IdentificationIcon className="h-3.5 w-3.5" />
                              {user.email.endsWith('@lnkd.ai') ? 'SUPER ADMIN' : user.role.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                              <CalendarIcon className="h-3.5 w-3.5" />
                              {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'Never'}
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <button 
                              onClick={() => openResetModal(user)}
                              className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 transition"
                            >
                              Reset Password
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-12 text-center text-[10px] text-slate-400 font-medium italic">
          Access granted via official invitation only. All invites are logged in the activity stream.
        </p>

      </div>

      {showResetModal && selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowResetModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Reset Password</h2>
                <p className="text-sm text-slate-500">User: {selectedUser.name}</p>
              </div>
              <button onClick={() => setShowResetModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-black outline-none"
                  placeholder="Enter new password (min 6 chars)"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="flex-1 px-4 py-2 text-slate-600 bg-slate-100 rounded-lg font-bold text-sm hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resettingUser === selectedUser.id}
                  className="flex-1 px-4 py-2 bg-black text-white rounded-lg font-bold text-sm hover:bg-zinc-800 transition disabled:opacity-50"
                >
                  {resettingUser === selectedUser.id ? 'Resetting...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}