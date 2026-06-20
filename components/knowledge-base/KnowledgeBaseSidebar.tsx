import Link from 'next/link';
import { knowledgeBasePages } from '@/lib/knowledge-base/pages';

type KnowledgeBaseSidebarProps = {
  currentSlug: string;
};

export default function KnowledgeBaseSidebar({ currentSlug }: KnowledgeBaseSidebarProps) {
  return (
    <aside className="w-full lg:w-80 lg:flex-shrink-0">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Knowledge Base</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Dashboard Wiki</h2>
          <p className="mt-1 text-sm text-slate-500">Clean reference pages for each dashboard section.</p>
        </div>

        <nav className="space-y-2">
          {knowledgeBasePages.map((page) => {
            const href = page.slug === 'home' ? '/knowledge-base' : `/knowledge-base/${page.slug}`;
            const isActive = currentSlug === page.slug;

            return (
              <Link
                key={page.slug}
                href={href}
                className={`block rounded-xl border px-3 py-3 transition ${
                  isActive
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="text-sm font-semibold">{page.title}</div>
                {page.summary && (
                  <div className={`mt-1 text-xs leading-5 ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                    {page.summary}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
