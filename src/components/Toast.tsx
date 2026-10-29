import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

type T = { id: number; msg: string; action?: () => void };
let push: (t: T, ms: number) => void = () => {};
let seq = 0;

export function toast(msg: string, action?: () => void, ms = 2800) { push({ id: ++seq, msg, action }, ms); }

export function Toaster() {
  const [t, setT] = useState<T | null>(null);
  useEffect(() => {
    let timer: number | undefined;
    push = (x, ms) => { setT(x); clearTimeout(timer); timer = window.setTimeout(() => setT(null), ms); };
    return () => clearTimeout(timer);
  }, []);
  return (
    <AnimatePresence>
      {t && (
        <motion.div key={t.id} className="toast" role="status" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
          style={{ cursor: t.action ? 'pointer' : 'default' }} onClick={() => { t.action?.(); setT(null); }}>
          {t.msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
