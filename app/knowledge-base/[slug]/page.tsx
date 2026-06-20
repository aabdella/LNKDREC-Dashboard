import { notFound } from 'next/navigation';
import KnowledgeBasePage from '@/components/knowledge-base/KnowledgeBasePage';
import { getKnowledgeBasePageContent } from '@/lib/knowledge-base/getKnowledgeBasePage';

export default async function KnowledgeBaseSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getKnowledgeBasePageContent(slug);

  if (!page) {
    notFound();
  }

  return (
    <KnowledgeBasePage
      currentSlug={slug}
      title={page.title}
      content={page.content}
      exists={page.exists}
    />
  );
}
