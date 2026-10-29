import { FAMILIES, VARIABLES, type Family } from '../lib/variables';

interface Props { id: string; label: string; value: string; onChange: (v: string) => void; allowNone?: boolean; exclude?: string[] }

export default function VariableSelect({ id, label, value, onChange, allowNone, exclude = [] }: Props) {
  const fams = Object.keys(FAMILIES) as Family[];
  return (
    <div>
      <label className="lbl" htmlFor={id}>{label}</label>
      <select id={id} className="field" value={value} onChange={e => onChange(e.target.value)}>
        {allowNone && <option value="">ללא</option>}
        {fams.map(f => (
          <optgroup key={f} label={FAMILIES[f].name}>
            {VARIABLES.filter(v => v.family === f && !exclude.includes(v.key)).map(v => <option key={v.key} value={v.key}>{v.name}</option>)}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
