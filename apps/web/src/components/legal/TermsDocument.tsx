import type { ReactNode } from 'react';

/**
 * Turns the published terms (plain text: numbered sections "1. TITLE", clauses "1.1 text", bullets
 * "- text") into a readable document: section headings, a contents list, clause numbers set apart
 * from the text. Plain text stays the source of truth so staff can edit terms without markup.
 */

type Block =
  | { kind: 'intro'; text: string }
  | { kind: 'section'; id: string; number: string; title: string }
  | { kind: 'clause'; number: string; text: string; bullets: string[] }
  | { kind: 'text'; text: string };

function sentenceCase(title: string): string {
  const lower = title.toLowerCase();
  return (lower.charAt(0).toUpperCase() + lower.slice(1)).replace(/why me/gi, 'WHY ME');
}

export function parseTerms(body: string): Block[] {
  const blocks: Block[] = [];
  let seenSection = false;
  for (const raw of body.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (line === '') continue;

    const section = /^(\d{1,2})\.\s+(\S.*)$/.exec(line);
    if (section && section[2] === section[2].toUpperCase() && /[A-Z]/.test(section[2])) {
      seenSection = true;
      blocks.push({ kind: 'section', id: `section-${section[1]}`, number: section[1], title: sentenceCase(section[2]) });
      continue;
    }
    const clause = /^(\d{1,2}\.\d{1,2})\s+(\S.*)$/.exec(line);
    if (clause) {
      blocks.push({ kind: 'clause', number: clause[1], text: clause[2], bullets: [] });
      continue;
    }
    const bullet = /^-\s+(\S.*)$/.exec(line);
    if (bullet) {
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'clause') last.bullets.push(bullet[1]);
      else blocks.push({ kind: 'clause', number: '', text: '', bullets: [bullet[1]] });
      continue;
    }
    blocks.push(seenSection ? { kind: 'text', text: line } : { kind: 'intro', text: line });
  }
  return blocks;
}

export function TermsDocument({ body, contents = true }: { body: string; contents?: boolean }): ReactNode {
  const blocks = parseTerms(body);
  const sections = blocks.filter((b): b is Extract<Block, { kind: 'section' }> => b.kind === 'section');

  return (
    <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-text">
      {blocks.filter((b) => b.kind === 'intro').map((b, i) => (b.kind === 'intro' ? <p key={`intro-${i}`}>{b.text}</p> : null))}

      {contents && sections.length > 3 ? (
        <nav aria-label="Contents" className="my-2 rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-text-muted">Contents</h2>
          <ol className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="flex gap-2 py-1 font-medium text-primary hover:underline">
                  <span className="w-6 shrink-0 text-text-muted">{s.number}.</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'intro':
            return null;
          case 'section':
            return (
              <h2 key={b.id} id={b.id} className="mt-6 flex scroll-mt-24 gap-3 border-t border-border pt-5 text-xl font-bold">
                <span className="w-8 shrink-0 text-primary">{b.number}.</span>
                {b.title}
              </h2>
            );
          case 'clause':
            return (
              <div key={`c-${i}`} className="flex gap-3">
                <span className="w-8 shrink-0 pt-px text-sm font-semibold text-text-muted" aria-hidden={b.number === ''}>
                  {b.number}
                </span>
                <div className="min-w-0 flex-1">
                  {b.text ? <p>{b.text}</p> : null}
                  {b.bullets.length > 0 ? (
                    <ul className="mt-1 list-disc space-y-1 pl-5 marker:text-text-muted">
                      {b.bullets.map((item, j) => (
                        <li key={j}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            );
          case 'text':
            return (
              <p key={`t-${i}`} className="pl-11">
                {b.text}
              </p>
            );
        }
      })}
    </div>
  );
}
