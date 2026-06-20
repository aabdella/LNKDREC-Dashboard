import KnowledgeBaseSidebar from './KnowledgeBaseSidebar';
import MarkdownRenderer from './MarkdownRenderer';

type KnowledgeBasePageProps = {
  currentSlug: string;
  title: string;
  content: string;
  exists: boolean;
};

export default function KnowledgeBasePage({ currentSlug, title, content, exists }: KnowledgeBasePageProps) {
  const sectionLabel = currentSlug === 'home' ? 'Home' : 'Dashboard Section';

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="text-sm font-medium text-indigo-600">LNKDREC / Knowledge Base</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
              {sectionLabel}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
            <p className="mt-2 text-sm text-slate-500">
              Product-facing documentation rendered from markdown content in the repo.
            </p>
          </div>
          {!exists && (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              Draft pending
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <KnowledgeBaseSidebar currentSlug={currentSlug} />

        <section className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <MarkdownRenderer content={content} />
        </section>
      </div>
    </div>
  );
}
