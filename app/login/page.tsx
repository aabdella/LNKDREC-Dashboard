'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { ArrowRightIcon, EnvelopeIcon, LockClosedIcon } from '@heroicons/react/24/outline';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'password' | 'magic-link'>('password');

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if we are already logged in; if so, don't sign out.
    // This allows the redirect to work correctly.
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Only sign out if there's no session, or just rely on the middleware
        // Actually, to fix your loop, we should NOT sign out here automatically anymore.
      }
    };
    checkSession();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'password') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        window.location.href = '/';
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        alert('Check your email for the magic link!');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-[400px] animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Card Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-white rounded-2xl shadow-sm mb-6 border border-slate-100">
            <Image 
              src="/logo.jpg" 
              alt="LNKD Logo" 
              width={120} 
              height={60} 
              className="object-contain" 
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back</h1>
          <p className="text-slate-500 mt-2 text-sm font-medium">Please enter your details to sign in</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
          
          {/* Mode Switcher */}
          <div className="flex p-1 bg-slate-100 rounded-xl mb-8">
            <button 
              onClick={() => setMode('password')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${mode === 'password' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Password
            </button>
            <button 
              onClick={() => setMode('magic-link')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${mode === 'magic-link' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Magic Link
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-black transition-colors">
                  <EnvelopeIcon className="h-5 w-5" />
                </div>
                <input
                  type="email"
                  required
                  className="block w-full pl-11 pr-4 py-3 bg-slate-50 border-transparent border focus:border-black focus:bg-white rounded-xl text-sm transition-all duration-200 outline-none placeholder:text-slate-300"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {mode === 'password' && (
              <div className="animate-in fade-in duration-300">
                <div className="flex items-center justify-between mb-2 px-1">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Password</label>
                  <a href="#" className="text-[10px] font-bold text-slate-400 hover:text-black transition">Forgot?</a>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-black transition-colors">
                    <LockClosedIcon className="h-5 w-5" />
                  </div>
                  <input
                    type="password"
                    required
                    className="block w-full pl-11 pr-4 py-3 bg-slate-50 border-transparent border focus:border-black focus:bg-white rounded-xl text-sm transition-all duration-200 outline-none placeholder:text-slate-300"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-medium animate-in fade-in duration-200">
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black hover:bg-zinc-800 disabled:bg-zinc-400 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 mt-2 shadow-lg shadow-black/10 active:scale-[0.98]"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'password' ? 'Sign In' : 'Send Magic Link'}
                  <ArrowRightIcon className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center mt-8 text-xs text-slate-400 font-medium tracking-tight">
          LNKD Platform v2.4.0 · Secured by OpenClaw
        </p>
      </div>
    </div>
  );
}
