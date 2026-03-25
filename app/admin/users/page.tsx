'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { UserPlusIcon, EnvelopeIcon, UserIcon, ArrowLeftIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

export default function UserManagement() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
        // Since we are on client side, we'll call a server action for invitation
        // For now, let's use the basic invite if allowed, or suggest server-side
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
        } else {
            setMessage({ type: 'error', text: data.error || 'Failed to send invitation' });
        }
    } catch (err: any) {
        setMessage({ type: 'error', text: err.message || 'An unexpected error occurred' });
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-12 pb-24 px-6">
      <div className="max-w-2xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
            <Link href="/admin" className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-slate-200">
                <ArrowLeftIcon className="h-5 w-5 text-slate-500" />
            </Link>
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">User Management</h1>
                <p className="text-slate-500 font-medium">Add new team members to the platform</p>
            </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-3xl p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
          <div className="inline-flex items-center gap-3 p-4 bg-indigo-50 rounded-2xl mb-8 border border-indigo-100">
            <div className="bg-white p-2 rounded-xl shadow-sm text-indigo-600">
              <UserPlusIcon className="h-6 w-6" />
            </div>
            <span className="text-sm font-bold text-indigo-900 uppercase tracking-wide">New Member Invite</span>
          </div>

          <form onSubmit={handleAddUser} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Full Name</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-black transition-colors">
                  <UserIcon className="h-5 w-5" />
                </div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  type="text"
                  required
                  className="block w-full pl-11 pr-4 py-4 bg-slate-50 border-transparent border focus:border-black focus:bg-white rounded-2xl text-sm transition-all duration-200 outline-none placeholder:text-slate-300"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-black transition-colors">
                  <EnvelopeIcon className="h-5 w-5" />
                </div>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  className="block w-full pl-11 pr-4 py-4 bg-slate-50 border-transparent border focus:border-black focus:bg-white rounded-2xl text-sm transition-all duration-200 outline-none placeholder:text-slate-300"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            {message && (
              <div className={`p-4 rounded-2xl text-xs font-bold animate-in fade-in duration-300 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                {message.type === 'success' ? '✅' : '⚠️'} {message.text}
              </div>
            )}

            <button
              disabled={loading}
              type="submit"
              className="w-full bg-black hover:bg-zinc-800 text-white font-bold py-5 rounded-2xl flex items-center justify-center gap-3 transition-all duration-200 shadow-xl shadow-black/10 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
              ) : (
                  <>Send Platform Invitation <UserPlusIcon className="h-5 w-5" /></>
              )}
            </button>
          </form>
        </div>

        {/* Security Note */}
        <p className="mt-8 text-center text-xs text-slate-400 font-medium italic">
          Newly added users will receive an invitation email and can only access non-admin features.
        </p>

      </div>
    </div>
  );
}
