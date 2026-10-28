import { wordAccuracy, words as toWords } from './text.ts';

/** Numbers and spelling practice: prices, dates, times, phone numbers, emails, spelling names. */
export type NumberCategory = 'price' | 'date' | 'time' | 'phone' | 'year' | 'big' | 'percent' | 'decimal' | 'email' | 'spell';

export interface NumberItem {
  category: NumberCategory;
  /** What is shown, e.g. "$24.99". */
  written: string;
  /** A short sentence using it, for the model voice and context. */
  sentence: string;
  /** Spoken forms that count as correct (words). */
  spoken: string[];
  /** Digits (or letters for spelling) that count as correct when the recogniser writes numbers. */
  compact: string;
}

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** 1234 -> "one thousand two hundred thirty four" (American, no "and"). */
export function numberToWords(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : '');
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` ${numberToWords(n % 100)}` : ''}`;
  for (const [size, name] of [
    [1_000_000_000, 'billion'],
    [1_000_000, 'million'],
    [1000, 'thousand'],
  ] as const) {
    if (n >= size) return `${numberToWords(Math.floor(n / size))} ${name}${n % size ? ` ${numberToWords(n % size)}` : ''}`;
  }
  return String(n);
}

const ORD: Record<string, string> = { one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth' };
export function ordinalWords(n: number): string {
  const w = numberToWords(n).split(' ');
  const last = w.pop()!;
  const o = ORD[last] ?? (last.endsWith('y') ? `${last.slice(0, -1)}ieth` : `${last}th`);
  return [...w, o].join(' ');
}

/** 2026 -> "twenty twenty six"; 2005 -> "two thousand five". */
export function yearWords(y: number): string[] {
  const hi = Math.floor(y / 100);
  const lo = y % 100;
  const forms = [numberToWords(y)];
  if (lo === 0) forms.push(`${numberToWords(hi)} hundred`);
  else if (lo < 10) forms.push(`${numberToWords(hi)} oh ${numberToWords(lo)}`);
  else forms.push(`${numberToWords(hi)} ${numberToWords(lo)}`);
  return forms;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const FIRST = ['sara', 'omar', 'lina', 'karim', 'maya', 'adam', 'nour', 'yusuf', 'hana', 'ziad'];
const LAST = ['khan', 'haddad', 'nasser', 'saleh', 'farah', 'mansour', 'aziz', 'qasim'];
const DOMAINS = ['gmail.com', 'outlook.com', 'company.com', 'yahoo.com'];
const SPELL = ['KHALID', 'HAMDAN', 'QURESHI', 'FATIMA', 'YOUSSEF', 'ABDULLAH', 'RASHID', 'BUSHRA', 'NAJJAR', 'ALWAZZAN', 'THWAIBI', 'VERONICA'];

type Rand = () => number;
const int = (r: Rand, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const pick = <T,>(r: Rand, xs: T[]) => xs[Math.floor(r() * xs.length)];

export function makeItem(category: NumberCategory, r: Rand = Math.random): NumberItem {
  switch (category) {
    case 'price': {
      const d = int(r, 2, 499);
      const c = pick(r, [0, 50, 99, 95, 25, 49]);
      const written = c ? `$${d}.${String(c).padStart(2, '0')}` : `$${d}`;
      const dw = numberToWords(d);
      const spoken = c ? [`${dw} ${numberToWords(c)}`, `${dw} dollars and ${numberToWords(c)} cents`, `${dw} dollars ${numberToWords(c)}`] : [`${dw} dollars`, dw];
      return { category, written, sentence: `It costs ${written}.`, spoken, compact: `${d}${c ? String(c).padStart(2, '0') : ''}` };
    }
    case 'date': {
      const m = int(r, 0, 11);
      const day = int(r, 1, 28);
      const written = `${MONTHS[m]} ${day}`;
      return { category, written, sentence: `The meeting is on ${written}.`, spoken: [`${MONTHS[m].toLowerCase()} ${ordinalWords(day)}`, `the ${ordinalWords(day)} of ${MONTHS[m].toLowerCase()}`], compact: String(day) };
    }
    case 'time': {
      const h = int(r, 1, 12);
      const min = pick(r, [0, 5, 15, 30, 45, 20, 40, 10]);
      const written = `${h}:${String(min).padStart(2, '0')}`;
      const spoken = [min === 0 ? `${numberToWords(h)} o'clock` : `${numberToWords(h)} ${min < 10 ? `oh ${numberToWords(min)}` : numberToWords(min)}`];
      if (min === 15) spoken.push(`quarter past ${numberToWords(h)}`);
      if (min === 30) spoken.push(`half past ${numberToWords(h)}`);
      if (min === 45) spoken.push(`quarter to ${numberToWords((h % 12) + 1)}`);
      return { category, written, sentence: `The train leaves at ${written}.`, spoken, compact: `${h}${String(min).padStart(2, '0')}` };
    }
    case 'phone': {
      const digits = `0${int(r, 5, 7)}${Array.from({ length: 8 }, () => int(r, 0, 9)).join('')}`;
      const written = `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
      const say = (d: string) => [...d].map((x) => (x === '0' ? 'oh' : ONES[Number(x)])).join(' ');
      return { category, written, sentence: `My number is ${written}.`, spoken: [say(digits), say(digits).replace(/oh/g, 'zero')], compact: digits };
    }
    case 'year': {
      const y = pick(r, [1998, 2005, 2010, 2019, 2024, 2026, 2031, 1985]);
      return { category, written: String(y), sentence: `I graduated in ${y}.`, spoken: yearWords(y), compact: String(y) };
    }
    case 'big': {
      const n = pick(r, [1250, 15400, 250000, 1_250_000, 3_400_000, 980, 12_000_000, 47_500]);
      const written = n.toLocaleString('en-US');
      return { category, written, sentence: `We sold ${written} units.`, spoken: [numberToWords(n)], compact: String(n) };
    }
    case 'percent': {
      const p = int(r, 3, 95);
      return { category, written: `${p}%`, sentence: `Sales grew by ${p}%.`, spoken: [`${numberToWords(p)} percent`], compact: String(p) };
    }
    case 'decimal': {
      const a = int(r, 0, 9);
      const b = int(r, 1, 9);
      return { category, written: `${a}.${b}`, sentence: `The rate is ${a}.${b}.`, spoken: [`${numberToWords(a)} point ${numberToWords(b)}`], compact: `${a}${b}` };
    }
    case 'email': {
      const f = pick(r, FIRST);
      const l = pick(r, LAST);
      const n = int(r, 10, 99);
      const dom = pick(r, DOMAINS);
      const email = `${f}.${l}${n}@${dom}`;
      const [dn, tld] = dom.split('.');
      return { category, written: email, sentence: `My email is ${email}.`, spoken: [`${f} dot ${l} ${numberToWords(n)} at ${dn} dot ${tld}`], compact: email.replace(/[^a-z0-9]/gi, '').toLowerCase() };
    }
    case 'spell': {
      const name = pick(r, SPELL);
      return { category, written: name, sentence: `Could you spell your name? ${[...name].join(' ')}.`, spoken: [[...name].join(' ').toLowerCase()], compact: name.toLowerCase() };
    }
  }
}

/** Is what was said an acceptable way of saying the item? */
export function acceptNumber(item: NumberItem, transcript: string): boolean {
  const t = transcript.toLowerCase();
  if (item.category === 'spell' || item.category === 'email') {
    // Letters spelled one by one ("k h a l i d") or the address written out by the recogniser.
    const compact = t.replace(/\bdot\b/g, '').replace(/\bat\b/g, '').replace(/[^a-z0-9]/g, '');
    if (compact === item.compact) return true;
  } else {
    const digits = t.replace(/[^0-9]/g, '');
    if (digits && digits.includes(item.compact) && (item.category !== 'date' || toWords(item.written)[0] === toWords(t).find((w) => MONTHS.map((m) => m.toLowerCase()).includes(w)))) return true;
  }
  return item.spoken.some((s) => wordAccuracy(s, t.replace(/-/g, ' ')) >= 0.85);
}

export const CATEGORY_LABELS: Record<NumberCategory, string> = {
  price: 'Prices',
  date: 'Dates',
  time: 'Times',
  phone: 'Phone numbers',
  year: 'Years',
  big: 'Big numbers',
  percent: 'Percentages',
  decimal: 'Decimals',
  email: 'Email addresses',
  spell: 'Spelling names',
};
