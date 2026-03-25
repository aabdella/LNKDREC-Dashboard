'use client';

import { PowerIcon } from '@heroicons/react/24/outline';
import { logoutAction } from '../actions/auth';

export default function LogoutButton() {
  const handleLogout = async () => {
    // Call the server action to sign out and redirect
    await logoutAction();
  };

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors px-2 py-1 rounded border border-transparent hover:border-zinc-700 bg-zinc-900/50"
    >
      <PowerIcon className="h-3.5 w-3.5" />
      Logout
    </button>
  );
}
