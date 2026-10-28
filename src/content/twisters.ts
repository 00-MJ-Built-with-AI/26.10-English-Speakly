/** Tongue twisters, each aimed at one sound drill (sound ids from sounds.ts). Classic folk rhymes or written for this app. */
export interface Twister {
  id: string;
  sound: string;
  text: string;
}

export const TWISTERS: Twister[] = [
  { id: 'pb1', sound: 'p-b', text: 'Peter Piper picked a peck of pickled peppers.' },
  { id: 'pb2', sound: 'p-b', text: 'Big black bugs bleed blue blood, but baby black bugs bleed black blood.' },
  { id: 'pb3', sound: 'p-b', text: 'Please pass the pepper to the busy baker.' },
  { id: 'fv1', sound: 'f-v', text: 'Vincent vowed vengeance very vehemently.' },
  { id: 'fv2', sound: 'f-v', text: 'Five very fine vans drove fast for vast fields.' },
  { id: 'th1', sound: 'th-voiceless', text: 'I thought a thought, but the thought I thought was not the thought I thought I thought.' },
  { id: 'th2', sound: 'th-voiceless', text: 'Thirty-three thousand thirsty thinkers thanked Thursday.' },
  { id: 'dh1', sound: 'th-voiced', text: 'The other brother would rather gather with their father.' },
  { id: 'ih1', sound: 'ih-ee', text: 'Six sleek sheep sit still on the ship.' },
  { id: 'ih2', sound: 'ih-ee', text: 'Fill the feel of the field with a little sweet wheat.' },
  { id: 'e1', sound: 'e-ih', text: 'Ten pens left in the tent, then seven pins went in.' },
  { id: 'ae1', sound: 'ae', text: 'A fat cat sat on a flat black mat.' },
  { id: 'ae2', sound: 'ae', text: "Jack's bad back made the cab driver laugh." },
  { id: 'r1', sound: 'r', text: 'Red lorry, yellow lorry, red lorry, yellow lorry.' },
  { id: 'r2', sound: 'r', text: 'Her first word was "world", and her third word was "work".' },
  { id: 'r3', sound: 'r', text: 'Rory rarely reads really rare reports.' },
  { id: 'ch1', sound: 'ch-sh', text: 'She sells seashells by the seashore.' },
  { id: 'ch2', sound: 'ch-sh', text: 'Cheap ships check shiny chips in Chile.' },
  { id: 'ng1', sound: 'ng', text: 'The king was singing a long song while bringing the ring.' },
  { id: 'cl1', sound: 'clusters-start', text: 'Six slim strong students strolled down the street.' },
  { id: 'cl2', sound: 'clusters-end', text: 'She asked for the texts, the lists and the masks.' },
  { id: 'oo1', sound: 'oo', text: 'Look, a good cook could cook good food.' },
];

/** Speeds for each round: model playback rate and the words-per-minute goal. */
export const TWISTER_SPEEDS = [
  { label: 'Slow', rate: 0.75, wpm: 90 },
  { label: 'Normal', rate: 1, wpm: 130 },
  { label: 'Fast', rate: 1.2, wpm: 170 },
] as const;
