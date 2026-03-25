import Link from 'next/link';
import { 
  ClipboardDocumentListIcon, 
  UserGroupIcon, 
  ChevronRightIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';

export default function AdminDashboard() {
  const sections = [
    {
      title: 'Dashboard Logs',
      desc: 'Monitor platform activity and server events',
      href: '/log',
      icon: ClipboardDocumentListIcon,
      color: 'blue'
    },
    {
      title: 'User Management',
      desc: 'Add and manage platform users',
      href: '/admin/users',
      icon: UserGroupIcon,
      color: 'indigo'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 pt-12 pb-24 px-6">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
            <Link href="/" className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-slate-200">
                <ArrowLeftIcon className="h-5 w-5 text-slate-500" />
            </Link>
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Admin Dashboard</h1>
                <p className="text-slate-500 font-medium">Platform settings and oversight</p>
            </div>
        </div>

        {/* Menu Grid */}
        <div className="grid md:grid-cols-2 gap-6 mt-12">
          {sections.map((section) => (
            <Link 
              key={section.href} 
              href={section.href}
              className="group relative bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 hover:border-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300"
            >
              <div className="flex items-start justify-between">
                <div className={`p-4 rounded-2xl bg-${section.color}-500/10 text-${section.color}-600 group-hover:scale-110 transition-transform duration-300`}>
                  <section.icon className="h-8 w-8" />
                </div>
                <ChevronRightIcon className="h-6 w-6 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
              </div>
              
              <div className="mt-6">
                <h3 className="text-xl font-bold text-slate-900">{section.title}</h3>
                <p className="text-slate-500 mt-2 text-sm leading-relaxed">{section.desc}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Info Footer */}
        <div className="mt-16 p-6 rounded-2xl bg-zinc-900 text-zinc-400 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
            <span>Platform Status: Operational</span>
          </div>
          <span>v2.4.0-admin</span>
        </div>

      </div>
    </div>
  );
}
