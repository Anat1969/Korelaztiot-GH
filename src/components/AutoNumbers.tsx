import { useLayoutEffect, useRef, type ReactNode } from 'react';

// Long static prose (the method page): numbers become bold, monospace and LTR-isolated after render,
// so the reading layer holds without hand-marking every figure.
const NUM = /((?:(?<![֐-׿])[-+−])?\d[\d,]*(?:\.\d+)?%?)/g;

export default function AutoNumbers({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.parentElement?.closest('.num, code, input, svg') ? NodeFilter.FILTER_REJECT : /\d/.test(n.nodeValue ?? '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    const nodes: Text[] = [];
    // every sentence on a new line: a <br> after ". " inside paragraphs and list items
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => (/[.?!]\s+\S/.test(n.nodeValue ?? '') && n.parentElement?.closest('p, li') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    const sn: Text[] = [];
    while (tw.nextNode()) sn.push(tw.currentNode as Text);
    for (const t of sn) {
      const parts = (t.nodeValue ?? '').split(/(?<=[.?!])\s+(?=\S)/);
      const frag = document.createDocumentFragment();
      parts.forEach((p, i) => { frag.appendChild(document.createTextNode(p)); if (i < parts.length - 1) frag.appendChild(document.createElement('br')); });
      t.replaceWith(frag);
    }
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    for (const t of nodes) {
      const parts = (t.nodeValue ?? '').split(NUM);
      if (parts.length < 2) continue;
      const frag = document.createDocumentFragment();
      parts.forEach((p, i) => {
        if (i % 2) { const b = document.createElement('bdi'); b.className = 'num'; b.textContent = p; frag.appendChild(b); }
        else if (p) frag.appendChild(document.createTextNode(p));
      });
      t.replaceWith(frag);
    }
  }, []);
  return <div ref={ref} className={className}>{children}</div>;
}
