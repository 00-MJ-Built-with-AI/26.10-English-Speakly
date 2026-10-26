import { annotate } from '../../engine/rhythm.ts';

/** Text with the beat marked: strong words bold with a dot above, weak words light, ‿ where words link. */
export function RhythmText({ text }: { text: string }) {
  const tokens = annotate(text);
  return (
    <div className="rhythm" aria-label={text}>
      {tokens.map((t, i) => (
        <span key={i} className="rhythm-word">
          <span className={`r-${t.stress}`}>{t.text}</span>
          {t.linkNext ? <span className="r-link">‿</span> : ' '}
        </span>
      ))}
    </div>
  );
}

export function RhythmLegend() {
  return (
    <div className="small faint">
      <b style={{ color: 'var(--text)' }}>Bold •</b> = stressed (on the beat) · <span style={{ opacity: 0.55 }}>light</span> = weak, said quickly · ‿ = link into the next word
    </div>
  );
}
