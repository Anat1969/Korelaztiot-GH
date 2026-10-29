// Rich text after the design-language template: **bold**, ==insight== (yellow marker), numbers isolated LTR and bold.
import type { ElementType } from 'react';

const TOKEN = /(\*\*[^*]+\*\*|==[^=]+==)/g;
// a sign counts only when it does not follow a Hebrew letter: in "בכ-20" the hyphen is a prefix joiner, not a minus
const NUM = /((?:(?<![\u0590-\u05ff])[-+\u2212])?\d[\d,]*(?:\.\d+)?%?)/g;

function Numbers({ text }: { text: string }) {
  return <>{text.split(NUM).map((part, i) => (i % 2 ? <bdi key={i} className="num">{part.replace(/[⁦⁩]/g, '')}</bdi> : part))}</>;
}

export default function Rich({ children, as: Tag = 'span', className }: { children: string; as?: ElementType; className?: string }) {
  const clean = String(children).replace(/[⁦⁩]/g, '');
  return (
    <Tag className={className}>
      {clean.split(TOKEN).map((part, i) => {
        if (part.startsWith('**')) return <strong key={i}><Numbers text={part.slice(2, -2)} /></strong>;
        if (part.startsWith('==')) return <mark key={i} className="insight"><Numbers text={part.slice(2, -2)} /></mark>;
        return <Numbers key={i} text={part} />;
      })}
    </Tag>
  );
}
