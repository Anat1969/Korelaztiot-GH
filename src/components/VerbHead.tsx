import { Link } from 'react-router';
import Rich from './Rich';

/** Page head: the verb, one distilled line, and the tool's sub-tabs (state kept in ?tab=). */
export default function VerbHead({ verb, line, tabs, tab, base }: { verb: string; line: string; tabs?: { k: string; label: string }[]; tab?: string; base?: string }) {
  return (
    <>
      <div className="verbhead rise">
        <div className="verb">{verb}</div>
        <Rich as="p" className="what">{line}</Rich>
      </div>
      {tabs && (
        <nav className="tabs" aria-label={`כלי ${verb}`}>
          {tabs.map(t => (
            <Link key={t.k} to={`${base}?tab=${t.k}`} className="check" aria-pressed={tab === t.k} replace>{t.label}</Link>
          ))}
        </nav>
      )}
    </>
  );
}
