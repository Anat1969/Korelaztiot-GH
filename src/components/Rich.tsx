// Rich text after the design-language template: **bold**, ==insight== (yellow marker), numbers isolated LTR and bold.
// Every sentence starts on a new line (Anat's rule).
import type { ElementType } from 'react';

const TOKEN = /(\*\*[^*]+\*\*|==[^=]+==)/g;
// a sign counts only when it does not follow a Hebrew letter: in "בכ-20" the hyphen is a prefix joiner, not a minus
const NUM = /((?:(?<![֐-׿])[-+−])?\d[\d,]*(?:\.\d+)?%?)/g;
// a sentence ends at . ? or ! followed by a space; "0.58" has no space after the dot and stays whole
const SENTENCE = /(?<=[.?!])\s+(?=\S)/;

function Numbers({ text }: { text: string }) {
  return <>{text.split(NUM).map((part, i) => (i % 2 ? <bdi key={i} className="num">{part}</bdi> : part))}</>;
}

function Inline({ text }: { text: string }) {
  return <>{text.split(TOKEN).map((part, i) => {
    if (part.startsWith('**')) return <strong key={i}><Numbers text={part.slice(2, -2)} /></strong>;
    if (part.startsWith('==')) return <mark key={i} className="insight"><Numbers text={part.slice(2, -2)} /></mark>;
    return <Numbers key={i} text={part} />;
  })}</>;
}

/** Splits into sentences without cutting a **bold** or ==marked== span in two. */
function sentences(text: string): string[] {
  const out: string[] = [];
  let cur = '';
  for (const piece of text.split(SENTENCE)) {
    cur = cur ? `${cur} ${piece}` : piece;
    const open = ((cur.match(/\*\*/g) ?? []).length % 2) + ((cur.match(/==/g) ?? []).length % 2);
    if (!open) { out.push(cur); cur = ''; }
  }
  if (cur) out.push(cur);
  return out;
}

export default function Rich({ children, as: Tag = 'span', className }: { children: string; as?: ElementType; className?: string }) {
  const clean = String(children).replace(/[⁦⁩]/g, '');
  const list = sentences(clean);
  return (
    <Tag className={className}>
      {list.map((s, i) => <span key={i} className="sentence"><Inline text={s} />{i < list.length - 1 && <br />}</span>)}
    </Tag>
  );
}
