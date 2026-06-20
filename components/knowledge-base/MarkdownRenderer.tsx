type MarkdownRendererProps = {
  content: string;
};

function formatInline(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="rounded bg-slate-100 px-1.5 py-0.5 text-[0.9em] text-slate-800">$1</code>');
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const lines = content.split('\n');
  const elements: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      elements.push('</ul>');
      inList = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      closeList();
      continue;
    }

    if (line.startsWith('# ')) {
      closeList();
      elements.push(`<h1>${formatInline(line.slice(2))}</h1>`);
      continue;
    }

    if (line.startsWith('## ')) {
      closeList();
      elements.push(`<h2>${formatInline(line.slice(3))}</h2>`);
      continue;
    }

    if (line.startsWith('### ')) {
      closeList();
      elements.push(`<h3>${formatInline(line.slice(4))}</h3>`);
      continue;
    }

    if (line.startsWith('- ')) {
      if (!inList) {
        elements.push('<ul>');
        inList = true;
      }
      elements.push(`<li>${formatInline(line.slice(2))}</li>`);
      continue;
    }

    closeList();
    elements.push(`<p>${formatInline(line)}</p>`);
  }

  closeList();

  return (
    <div
      className="kb-markdown text-slate-800"
      dangerouslySetInnerHTML={{ __html: elements.join('') }}
    />
  );
}
