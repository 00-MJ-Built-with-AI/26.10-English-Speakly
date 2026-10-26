import type { Lips, MouthShape, Tongue } from '../../content/mouth.ts';

type P = [number, number];

/** Upper surface of the tongue from tip to root, for each position (side view, face to the left). */
const TONGUE: Record<Tongue, P[]> = {
  rest: [[58, 103], [72, 97], [100, 92], [130, 98], [150, 130]],
  'between-teeth': [[45, 100], [60, 99], [95, 95], [128, 100], [150, 130]],
  ridge: [[60, 88], [70, 87], [98, 92], [130, 98], [150, 130]],
  sh: [[63, 95], [80, 81], [104, 88], [132, 98], [150, 130]],
  'front-high': [[58, 104], [72, 88], [94, 76], [128, 92], [150, 130]],
  'front-mid': [[58, 108], [74, 96], [96, 86], [128, 96], [150, 130]],
  'low-front': [[60, 118], [76, 112], [100, 104], [130, 104], [150, 132]],
  central: [[59, 110], [76, 102], [102, 94], [130, 98], [150, 130]],
  'low-back': [[60, 120], [78, 116], [104, 110], [132, 104], [150, 132]],
  'back-high': [[58, 108], [74, 104], [100, 92], [126, 78], [150, 128]],
  bunched: [[66, 106], [78, 96], [102, 82], [130, 92], [150, 130]],
  velar: [[58, 106], [74, 100], [104, 92], [136, 74], [152, 128]],
};

/** Where the tongue or lips make contact, highlighted with a dot. */
const CONTACT: Partial<Record<Tongue, P>> = { ridge: [61, 87], velar: [137, 73], 'between-teeth': [50, 99] };

const mid = (a: P, b: P): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

function smooth(points: P[]): string {
  let d = `M${points[0][0]},${points[0][1]} L${mid(points[0], points[1]).join(',')}`;
  for (let i = 1; i < points.length - 1; i++) d += ` Q${points[i].join(',')} ${mid(points[i], points[i + 1]).join(',')}`;
  return `${d} L${points[points.length - 1].join(',')}`;
}

function upperLip(lips: Lips): string {
  if (lips === 'round') return 'M43,84 C34,86 31,93 35,97 L52,96';
  if (lips === 'spread') return 'M44,84 C40,88 40,93 43,96 L52,96';
  return 'M43,84 C38,88 37,93 41,96 L52,96';
}

function lowerLip(lips: Lips, j: number): string {
  if (lips === 'closed') return 'M52,98 L41,97 C36,101 37,108 42,112';
  if (lips === 'lip-teeth') return `M55,98 C46,96 42,100 43,106 C44,110 45,${112 + j} 44,${113 + j}`;
  if (lips === 'round') return `M52,${100 + j} L37,${100 + j} C32,${103 + j} 33,${108 + j} 40,${112 + j}`;
  return `M52,${99 + j} L41,${99 + j} C37,${102 + j} 37,${108 + j} 42,${112 + j}`;
}

/** Simplified side view of the mouth for one sound. */
export function MouthDiagram({ shape, size = 220 }: { shape: MouthShape; size?: number }) {
  const j = shape.lips === 'closed' || shape.lips === 'lip-teeth' ? Math.min(shape.jaw, 2) * 1.5 : shape.jaw * 1.5;
  const t = TONGUE[shape.tongue];
  const tip = t[0];
  const lipY = shape.lips === 'closed' ? 97 : 98 + j / 2;
  const root = t[t.length - 1];
  const tongue = `${smooth(t)} C${root[0] + 2},${root[1] + 14} ${root[0] - 6},${root[1] + 20} ${root[0] - 20},${root[1] + 20} C108,${root[1] + 18 + j * 0.3} 84,${tip[1] + 22 + j * 0.2} ${tip[0] + 10},${tip[1] + 12} C${tip[0] + 4},${tip[1] + 9} ${tip[0]},${tip[1] + 4} ${tip[0]},${tip[1]} Z`;
  const top = Math.min(t[1][1], t[2][1]) - 8;
  // A hiss (/s/) squeezes air past a contact; a stop (/t/, /d/, /g/) blocks it.
  const blocked = shape.lips === 'closed' || ((shape.tongue === 'ridge' || shape.tongue === 'velar') && shape.air !== 'hiss');
  const oralAir = !shape.nasal && shape.air !== 'none' && (!blocked || shape.air === 'puff');
  const contact = CONTACT[shape.tongue];
  const id = `m${shape.label.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg viewBox="0 0 200 190" width={size} height={(size * 190) / 200} role="img" aria-label={`Mouth position for ${shape.label}`}>
      <defs>
        <marker id={id} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--brand)" />
        </marker>
      </defs>
      {/* head, nose, nasal cavity, palate, throat */}
      <path d="M100,6 C78,6 62,18 58,34 C56,42 50,50 34,62 C30,66 34,70 46,72 C44,76 43,80 43,84" fill="none" stroke="var(--muted)" strokeWidth="2" />
      <path d="M50,70 C72,60 118,58 150,64 C158,66 162,72 162,80" fill="none" stroke="var(--line)" strokeWidth="1.5" />
      <path d="M57,88 C62,85 65,80 72,76 C90,68 116,68 134,72" fill="none" stroke="var(--muted)" strokeWidth="2.5" />
      <path d={shape.nasal ? 'M134,72 Q148,80 146,96' : 'M134,72 Q154,70 160,80'} fill="none" stroke="var(--muted)" strokeWidth="4" strokeLinecap="round" />
      <path d="M162,64 C168,90 168,140 160,186" fill="none" stroke="var(--muted)" strokeWidth="2" />
      <path d={`M42,${112 + j} C40,${124 + j} 46,${138 + j} 62,${144 + j} C80,${150 + j} 100,${150 + j} 118,${146 + j} L132,186`} fill="none" stroke="var(--muted)" strokeWidth="2" />
      {/* tongue */}
      <path d={tongue} fill="#f2a0ad" stroke="#d9707f" strokeWidth="1.5" />
      {/* teeth */}
      <path d="M51,88 L57,88 L56,99 L52,99 Z" fill="#fff" stroke="var(--muted)" strokeWidth="1" />
      <path d={`M52,${101 + j} L57,${101 + j} L58,${111 + j} L53,${111 + j} Z`} fill="#fff" stroke="var(--muted)" strokeWidth="1" />
      {/* lips */}
      <path d={upperLip(shape.lips)} fill="none" stroke="#d9707f" strokeWidth="3" strokeLinecap="round" />
      <path d={lowerLip(shape.lips, j)} fill="none" stroke="#d9707f" strokeWidth="3" strokeLinecap="round" />
      {/* air */}
      {oralAir && shape.air !== 'puff' && (
        <path
          d={`M152,176 C156,150 156,122 146,110 C126,${top} 90,${top} 70,${lipY} L26,${lipY}`}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="2"
          strokeDasharray={shape.air === 'hiss' ? '2 3' : '6 4'}
          markerEnd={`url(#${id})`}
        />
      )}
      {shape.air === 'puff' && (
        <g stroke="var(--brand)" strokeWidth="2" strokeLinecap="round">
          <path d={`M26,${lipY - 5} l-8,-4 M25,${lipY} l-10,0 M26,${lipY + 5} l-8,4`} />
        </g>
      )}
      {shape.nasal && (
        <path d="M152,176 C156,150 157,112 150,98 C148,82 140,68 120,64 C90,62 60,64 32,66" fill="none" stroke="var(--brand)" strokeWidth="2" strokeDasharray="6 4" markerEnd={`url(#${id})`} />
      )}
      {contact && <circle cx={contact[0]} cy={contact[1]} r="4" fill="none" stroke="var(--bad)" strokeWidth="2" />}
      {shape.lips === 'closed' && <circle cx="40" cy="97" r="4" fill="none" stroke="var(--bad)" strokeWidth="2" />}
      {shape.lips === 'lip-teeth' && <circle cx="53" cy="98" r="4" fill="none" stroke="var(--bad)" strokeWidth="2" />}
      {/* voice box */}
      {shape.voiced ? (
        <path d="M138,178 l4,-4 l4,8 l4,-8 l4,8 l4,-4" fill="none" stroke="var(--flu)" strokeWidth="2" />
      ) : (
        <path d="M138,176 L158,176 M138,180 L158,180" stroke="var(--faint)" strokeWidth="2" />
      )}
    </svg>
  );
}

/** One or two diagrams with labels: voice on/off, air through the nose. */
export function MouthPair({ target, contrast }: { target: MouthShape; contrast?: MouthShape }) {
  const card = (s: MouthShape, main: boolean) => (
    <div className="soft" style={{ textAlign: 'center', flex: 1, minWidth: 180 }}>
      <MouthDiagram shape={s} size={200} />
      <div style={{ fontWeight: 700 }}>{s.label}</div>
      <div className="row" style={{ justifyContent: 'center', marginTop: 4 }}>
        <span className={`chip ${s.voiced ? 'brand' : ''}`}>{s.voiced ? 'voice on' : 'voice off'}</span>
        {s.nasal && <span className="chip">air through nose</span>}
        {!main && <span className="chip">compare</span>}
      </div>
    </div>
  );
  return (
    <div className="stack">
      <div className="row" style={{ alignItems: 'stretch' }}>
        {card(target, true)}
        {contrast && card(contrast, false)}
      </div>
      <div className="small faint">Simplified side view. Red circle: where things touch. Blue dashes: air. Zigzag at the throat: voice on.</div>
    </div>
  );
}
