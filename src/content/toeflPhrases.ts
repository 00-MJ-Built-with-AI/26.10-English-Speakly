/** Useful phrases for the two TOEFL writing tasks (written for this app). */
export interface PhraseGroup {
  id: string;
  task: 'email' | 'discussion';
  title: string;
  /** When you'd use these, phrased as a drill prompt. */
  situation: string;
  phrases: string[];
}

export const PHRASES: PhraseGroup[] = [
  { id: 'open', task: 'email', title: 'Opening and purpose', situation: 'You start an email to a professor and say why you are writing.', phrases: ["I'm writing to ask about…", 'I am writing regarding…', 'I hope you are doing well. I wanted to let you know that…', "I'm contacting you because…"] },
  { id: 'request', task: 'email', title: 'Polite requests', situation: 'You ask an office for something politely.', phrases: ['Would it be possible to…?', 'Could you please let me know…?', 'I would really appreciate it if you could…', 'I was wondering whether…'] },
  { id: 'explain', task: 'email', title: 'Explaining a problem', situation: 'You explain why something went wrong.', phrases: ['Unfortunately, I was unable to… because…', 'Due to…, I missed…', 'I ran into a problem with…', 'The issue is that…'] },
  { id: 'suggest', task: 'email', title: 'Suggesting a solution', situation: 'You offer a way to fix the situation.', phrases: ['One option might be to…', 'Perhaps I could…', 'If it works for you, I could…', 'I would be happy to…'] },
  { id: 'close', task: 'email', title: 'Closing', situation: 'You end the email politely.', phrases: ['Thank you for your time and understanding.', 'I look forward to hearing from you.', 'Please let me know if you need anything else.', 'Thanks again for your help.'] },
  { id: 'view', task: 'discussion', title: 'Stating your view', situation: 'You give your own opinion in the first sentence of a discussion post.', phrases: ['In my view,…', 'I strongly believe that…', 'From my perspective,…', "I'd argue that…"] },
  { id: 'agree', task: 'discussion', title: 'Building on a classmate', situation: "You agree with a classmate's post and add to it.", phrases: ["I agree with Sara's point that…, and I'd add that…", "Building on Omar's idea,…", 'Sara makes a good point about…', "Like Omar, I think…, but for a different reason:"] },
  { id: 'disagree', task: 'discussion', title: 'Disagreeing politely', situation: 'You disagree with a classmate without being rude.', phrases: ["I see Omar's point, but…", "While Sara is right that…, I think…", "I'm not fully convinced that…", 'That may be true in some cases; however,…'] },
  { id: 'example', task: 'discussion', title: 'Adding an example', situation: 'You support your reason with something specific.', phrases: ['For example,…', 'A good example of this is…', 'In my own experience,…', 'To illustrate,…'] },
  { id: 'conclude', task: 'discussion', title: 'Wrapping up', situation: 'You finish your post with one sentence that ties back to the question.', phrases: ['For these reasons,…', 'Overall, I believe…', "That's why I think…", 'In short,…'] },
];
