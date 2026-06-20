import KnowledgeBasePage from '@/components/knowledge-base/KnowledgeBasePage';
import { getKnowledgeBasePageContent } from '@/lib/knowledge-base/getKnowledgeBasePage';

export default async function KnowledgeBaseHomePage() {
  const page = await getKnowledgeBasePageContent('home');

  if (!page) {
    throw new Error('Knowledge Base home page configuration is missing.');
  }

  return (
    <KnowledgeBasePage
      currentSlug="home"
      title={page.title}
      content={page.content}
      exists={page.exists}
    />
  );
}
