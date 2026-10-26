import type { Level } from '../../shared/tasks.ts';

/** Everyday workplace idioms and phrasal verbs, one per day. */
export interface Idiom {
  phrase: string;
  meaning: string;
  example: string;
  level: Level;
}

export const IDIOMS: Idiom[] = [
  { phrase: 'touch base', meaning: 'briefly contact someone to check in', example: "Let's touch base on Friday to see how it's going.", level: 'B1' },
  { phrase: 'on the same page', meaning: 'agreeing about something; having the same understanding', example: 'Before we start, I want to make sure we are all on the same page.', level: 'B1' },
  { phrase: 'get back to someone', meaning: 'reply later with an answer', example: "I'll check the numbers and get back to you this afternoon.", level: 'A2' },
  { phrase: 'a ballpark figure', meaning: 'a rough estimate', example: 'Can you give me a ballpark figure for the whole project?', level: 'B2' },
  { phrase: 'the ball is in their court', meaning: "it's their turn to act or decide", example: "We've sent our offer, so the ball is in their court now.", level: 'B2' },
  { phrase: 'come up with', meaning: 'think of an idea or plan', example: 'We need to come up with a better solution by Monday.', level: 'B1' },
  { phrase: 'run out of', meaning: 'use all of something so none is left', example: "We're running out of time, so let's skip to the last slide.", level: 'A2' },
  { phrase: 'figure out', meaning: 'understand or solve something', example: "I couldn't figure out why the report was wrong.", level: 'A2' },
  { phrase: 'follow up', meaning: 'contact someone again to continue or check something', example: "I'll follow up with the client after the meeting.", level: 'B1' },
  { phrase: 'set up', meaning: 'arrange or organize something', example: 'Could you set up a call with the design team?', level: 'A2' },
  { phrase: 'put off', meaning: 'delay or postpone', example: "Let's not put off this decision any longer.", level: 'B1' },
  { phrase: 'bring up', meaning: 'mention a topic', example: 'I wanted to bring up the budget issue.', level: 'B1' },
  { phrase: 'go over', meaning: 'review or check something carefully', example: "Let's go over the plan one more time.", level: 'B1' },
  { phrase: 'think outside the box', meaning: 'think in a new, creative way', example: 'We need to think outside the box to reach younger customers.', level: 'B2' },
  { phrase: 'cut corners', meaning: 'do something badly to save time or money', example: "We can't cut corners on safety testing.", level: 'B2' },
  { phrase: 'back to the drawing board', meaning: 'start planning again because the first plan failed', example: "The client rejected the design, so it's back to the drawing board.", level: 'B2' },
  { phrase: 'get the ball rolling', meaning: 'start something', example: "Let's get the ball rolling with a quick round of introductions.", level: 'B2' },
  { phrase: 'keep someone in the loop', meaning: 'keep someone informed', example: 'Please keep me in the loop about any changes.', level: 'B1' },
  { phrase: 'a win-win', meaning: 'a situation good for everyone', example: 'Flexible hours are a win-win for the company and the staff.', level: 'B1' },
  { phrase: 'hit the ground running', meaning: 'start working quickly and successfully', example: 'The new manager hit the ground running in her first week.', level: 'B2' },
  { phrase: 'up in the air', meaning: 'not decided yet', example: 'The launch date is still up in the air.', level: 'B2' },
  { phrase: 'on track', meaning: 'progressing as planned', example: "We're on track to finish by the end of the month.", level: 'B1' },
  { phrase: 'behind schedule', meaning: 'later than planned', example: 'The construction is two weeks behind schedule.', level: 'B1' },
  { phrase: 'call it a day', meaning: 'stop working for today', example: "It's late. Let's call it a day.", level: 'B1' },
  { phrase: 'on the fence', meaning: 'unable to decide', example: "I'm still on the fence about the new offer.", level: 'B2' },
  { phrase: 'a steep learning curve', meaning: 'something difficult to learn quickly', example: 'The new software has a steep learning curve.', level: 'B2' },
  { phrase: 'step up', meaning: 'take more responsibility or effort when needed', example: 'When Ali was sick, Rana really stepped up.', level: 'B2' },
  { phrase: 'take something on board', meaning: 'accept and consider advice or feedback', example: "Thanks for the feedback; I'll take it on board.", level: 'C1' },
  { phrase: 'get to the point', meaning: 'talk about the most important thing directly', example: "Let me get to the point: we need more budget.", level: 'B1' },
  { phrase: 'touch on', meaning: 'mention briefly', example: "I'll touch on the risks at the end of the presentation.", level: 'C1' },
  { phrase: 'iron out', meaning: 'solve small problems or details', example: 'We still need to iron out a few details in the contract.', level: 'C1' },
  { phrase: 'drop the ball', meaning: 'make a mistake by forgetting or not doing something', example: 'Sorry, I dropped the ball on that email.', level: 'B2' },
  { phrase: 'go the extra mile', meaning: 'do more than is expected', example: 'Our support team always goes the extra mile.', level: 'B2' },
  { phrase: 'in a nutshell', meaning: 'in a few words; briefly', example: "In a nutshell, sales are up but costs are up too.", level: 'B2' },
  { phrase: 'on short notice', meaning: 'with very little warning', example: 'Thanks for joining the call on such short notice.', level: 'B2' },
  { phrase: 'pull your weight', meaning: 'do your fair share of work', example: 'Everyone on the team needs to pull their weight.', level: 'C1' },
  { phrase: 'reach out', meaning: 'contact someone', example: 'Feel free to reach out if you have any questions.', level: 'B1' },
  { phrase: 'sleep on it', meaning: 'wait until tomorrow before deciding', example: "It's a big decision. Let me sleep on it.", level: 'B1' },
  { phrase: 'a no-brainer', meaning: 'an easy, obvious decision', example: 'Moving the meeting online was a no-brainer.', level: 'B2' },
  { phrase: 'from scratch', meaning: 'from the very beginning', example: 'We rebuilt the website from scratch.', level: 'B1' },
  { phrase: 'think on your feet', meaning: 'react quickly and well without preparing', example: 'In client meetings you have to think on your feet.', level: 'C1' },
  { phrase: 'a heads-up', meaning: 'a warning or notice in advance', example: 'Just a heads-up: the meeting room has changed.', level: 'B1' },
  { phrase: 'wrap up', meaning: 'finish', example: "Let's wrap up and agree on next steps.", level: 'B1' },
  { phrase: 'see eye to eye', meaning: 'agree completely', example: "We don't always see eye to eye, but we work well together.", level: 'C1' },
  { phrase: 'get the hang of', meaning: 'learn how to do something', example: "You'll get the hang of the new system in a few days.", level: 'B1' },
  { phrase: 'play it by ear', meaning: 'decide what to do as things happen, without a plan', example: "Let's play it by ear and see how the client reacts.", level: 'C1' },
  { phrase: 'a long shot', meaning: 'something unlikely to succeed', example: "It's a long shot, but let's apply for the grant.", level: 'C1' },
  { phrase: 'bite off more than you can chew', meaning: 'try to do more than you can manage', example: 'I bit off more than I could chew with three projects at once.', level: 'C1' },
  { phrase: 'fall through', meaning: 'fail to happen', example: 'The deal fell through at the last minute.', level: 'B2' },
  { phrase: 'take it from here', meaning: 'continue from this point (often taking over)', example: "Thanks, Omar. I'll take it from here.", level: 'B2' },
];

/** Same idiom all day; a new one tomorrow. */
export function idiomOfTheDay(d = new Date()): Idiom {
  const day = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000);
  return IDIOMS[(day * 7) % IDIOMS.length];
}
