/**
 * New TOEFL iBT (from January 2026) Speaking: about 8 minutes, 11 items, AI-scored on a 1-6 scale.
 * Task 1 "Listen and Repeat": 7 sentences in a campus setting, played once, getting longer;
 * repeat each exactly (about 8-12 s to answer). Task 2 "Take an Interview": 4 questions on one
 * topic, getting harder; about 45 s to answer each, no preparation time.
 */
export interface RepeatSet {
  id: string;
  topic: string;
  sentences: string[];
}

export interface InterviewSet {
  id: string;
  topic: string;
  intro: string;
  questions: string[];
}

export const REPEAT_SECONDS = (sentence: string) => (sentence.split(/\s+/).length <= 9 ? 8 : sentence.split(/\s+/).length <= 15 ? 10 : 12);
export const INTERVIEW_SECONDS = 45;

export const REPEAT_SETS: RepeatSet[] = [
  {
    id: 'r1',
    topic: 'A tour of the science building',
    sentences: [
      'This is the main science building.',
      'The labs are on the second floor.',
      'Please wear safety glasses in every lab.',
      'Lockers for your bags are next to the elevator.',
      'If you need help with equipment, ask one of the teaching assistants.',
      'The chemistry lab, which was renovated last year, is open until nine on weekdays.',
      'Students who want to use the lab on weekends must book a time slot online at least two days in advance.',
    ],
  },
  {
    id: 'r2',
    topic: 'Student services office',
    sentences: [
      'Welcome to student services.',
      'We can help you find housing.',
      'Our office is open Monday through Friday.',
      'You can also make an appointment on our website.',
      'Bring your student ID when you come to collect your parking permit.',
      'Students who are looking for part-time jobs should check the board near the entrance.',
      'If you have questions about financial aid, the adviser whose office is at the end of the hall can help you.',
    ],
  },
  {
    id: 'r3',
    topic: 'Campus bookstore',
    sentences: [
      'The bookstore is near the main gate.',
      'Used textbooks are cheaper than new ones.',
      'You can return a book within two weeks.',
      'Keep your receipt if you think you might return something.',
      'Digital versions of most textbooks are available at a lower price.',
      'During the first week of classes, the store stays open later than usual to help with the crowds.',
      'Students who order their books online before the semester starts can pick them up at the customer service desk.',
    ],
  },
  {
    id: 'r4',
    topic: 'Recreation center orientation',
    sentences: [
      'This is the recreation center.',
      'The pool opens at six in the morning.',
      'Towels are available at the front desk.',
      'Fitness classes are free for all registered students.',
      'Please clean the machines after you finish using them.',
      'The climbing wall, which is very popular, requires a short safety course before your first visit.',
      'If you would like to join an intramural team, you should sign up before the deadline at the end of the month.',
    ],
  },
];

export const INTERVIEW_SETS: InterviewSet[] = [
  {
    id: 'i1',
    topic: 'Study habits',
    intro: 'A researcher at your university is studying how students prepare for exams. She would like to ask you some questions.',
    questions: [
      'How do you usually prepare for an important exam?',
      'Do you prefer to study alone or with other people? Why?',
      'Some people say that cramming the night before an exam is effective. What do you think?',
      'How do you think technology will change the way students study in the future?',
    ],
  },
  {
    id: 'i2',
    topic: 'Working while studying',
    intro: 'A university is collecting opinions about students who work part-time while studying.',
    questions: [
      'Have you ever had a job while you were studying? Tell me about it.',
      'What are the advantages of working part-time as a student?',
      'Some professors believe that working hurts students\' grades. Do you agree? Explain.',
      'Should universities provide more paid jobs on campus? Why or why not?',
    ],
  },
  {
    id: 'i3',
    topic: 'Cities and the environment',
    intro: 'A city planning group is interviewing young people about the environment in cities.',
    questions: [
      'How do you usually travel around your city?',
      'What is one environmental problem in your city, and how does it affect people?',
      'Some people think cars should be banned from city centers. What is your opinion?',
      'What do you think cities will look like in fifty years?',
    ],
  },
  {
    id: 'i4',
    topic: 'Learning from history',
    intro: 'A history department wants to know how students feel about studying history.',
    questions: [
      'Did you enjoy history classes at school? Why or why not?',
      'Which historical period or event do you find most interesting, and why?',
      'Some people say that studying history is less useful than studying science or technology. Do you agree?',
      'How might the way we record history change because of social media and digital technology?',
    ],
  },
];

/** Overall section band: half-band steps, as on the new score report. */
export function combineBands(repeatBand: number | null, interviewBands: number[]): number | null {
  const parts = [...(repeatBand != null ? [repeatBand] : []), ...interviewBands];
  if (!parts.length) return null;
  // Repeat counts for 7 items, interview for 4; weight them roughly by item count.
  const iAvg = interviewBands.length ? interviewBands.reduce((a, b) => a + b, 0) / interviewBands.length : null;
  const v = repeatBand != null && iAvg != null ? (repeatBand * 7 + iAvg * 4) / 11 : (repeatBand ?? iAvg)!;
  return Math.round(v * 2) / 2;
}

/** Band for a Listen-and-Repeat answer from word accuracy (0-1) and pronunciation (0-100). */
export function repeatBand(wordAccuracy: number, pron: number): number {
  const s = 0.6 * wordAccuracy * 100 + 0.4 * pron;
  const band = s >= 92 ? 6 : s >= 84 ? 5.5 : s >= 76 ? 5 : s >= 68 ? 4.5 : s >= 60 ? 4 : s >= 52 ? 3.5 : s >= 44 ? 3 : s >= 36 ? 2.5 : s >= 28 ? 2 : s >= 18 ? 1.5 : 1;
  return band;
}
