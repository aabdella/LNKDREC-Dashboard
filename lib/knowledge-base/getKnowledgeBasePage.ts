import { promises as fs } from 'fs';
import path from 'path';
import { getKnowledgeBasePageBySlug } from './pages';

export async function getKnowledgeBasePageContent(slug: string) {
  const page = getKnowledgeBasePageBySlug(slug);

  if (!page) {
    return null;
  }

  const filePath = path.join(process.cwd(), 'content', 'knowledge-base', `${slug}.md`);

  try {
    const content = await fs.readFile(filePath, 'utf8');
    return {
      ...page,
      content,
      exists: true,
    };
  } catch {
    return {
      ...page,
      content: `# ${page.title}\n\nThis page has not been documented yet.`,
      exists: false,
    };
  }
}
