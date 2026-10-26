import type { Level, Scenario } from '../../shared/tasks.ts';

export interface ExtraScenario {
  id: string;
  kind: 'phone' | 'smalltalk';
  level: Level;
  scenario: Scenario;
  /** Useful phrases shown before starting. */
  phrases: string[];
}

export const PHONE_SCENARIOS: ExtraScenario[] = [
  {
    id: 'ph-doctor',
    kind: 'phone',
    level: 'A2',
    scenario: { title: "Booking a doctor's appointment", setting: 'You call a busy medical clinic', aiRole: 'the clinic receptionist', userRole: 'a patient', userGoal: 'book an appointment this week, explain your symptoms briefly, and confirm the time and your phone number' },
    phrases: ["Hi, I'd like to make an appointment, please.", "I've had a sore throat since Monday.", 'Do you have anything on Thursday afternoon?', "Could you repeat that, please?", 'My number is ... Let me spell my name: ...'],
  },
  {
    id: 'ph-support',
    kind: 'phone',
    level: 'B1',
    scenario: { title: 'Internet support call', setting: 'You call your internet provider because the connection keeps dropping', aiRole: 'a technical support agent who follows a script', userRole: 'a customer working from home', userGoal: 'explain the problem clearly, go through the checks, and get a technician visit or a fix with a date' },
    phrases: ['The connection keeps dropping every few minutes.', "I've already restarted the router.", 'Could you send a technician?', "What's the reference number for this call?", 'Just to confirm, ...'],
  },
  {
    id: 'ph-hotel',
    kind: 'phone',
    level: 'A2',
    scenario: { title: 'Hotel booking', setting: 'You call a hotel to book a room for a business trip', aiRole: 'the hotel reservations agent', userRole: 'a business traveler', userGoal: 'book a room for 3 nights, ask about breakfast and airport transfer, and spell your name and email' },
    phrases: ["I'd like to book a room from the 12th to the 15th.", 'Is breakfast included?', 'Do you offer an airport shuttle?', "My email is m dot ... at gmail dot com.", "That's M as in Mike."],
  },
  {
    id: 'ph-delivery',
    kind: 'phone',
    level: 'B1',
    scenario: { title: 'Missing delivery', setting: 'You call a delivery company because your package says delivered but you never got it', aiRole: 'a customer service agent', userRole: 'the customer', userGoal: 'explain what happened, give the tracking number, and agree on a refund or redelivery' },
    phrases: ['It says it was delivered, but I never received it.', 'The tracking number is ...', 'I was home all day.', 'What are my options?', 'When can I expect an update?'],
  },
  {
    id: 'ph-client',
    kind: 'phone',
    level: 'B2',
    scenario: { title: 'Client call: project delay', setting: 'You call an important client to tell them a delivery will be one week late', aiRole: 'the client, a busy and slightly impatient operations director', userRole: 'the account manager', userGoal: 'explain the delay and the reason, apologize, offer a plan, and keep the relationship positive' },
    phrases: ["I'm calling about the delivery date.", "Unfortunately, we're running about a week behind.", 'The main reason is ...', "Here's what we're going to do: ...", 'I completely understand.'],
  },
  {
    id: 'ph-landlord',
    kind: 'phone',
    level: 'B1',
    scenario: { title: 'Calling the landlord', setting: 'You call your landlord because the air conditioning is broken in summer', aiRole: 'the landlord, who is a bit slow to fix things', userRole: 'the tenant', userGoal: 'describe the problem, stress that it is urgent, and get a repair date' },
    phrases: ["The air conditioning hasn't been working since yesterday.", "It's really urgent because ...", 'Could someone come today or tomorrow?', 'Can you confirm the time?'],
  },
  {
    id: 'ph-interview-screen',
    kind: 'phone',
    level: 'B2',
    scenario: { title: 'Recruiter phone screen', setting: 'A recruiter calls you about a job you applied for', aiRole: 'a friendly but fast-talking recruiter', userRole: 'the candidate', userGoal: 'summarize your background, answer questions about salary expectations and notice period, and schedule the next interview' },
    phrases: ["Yes, this is a good time.", "In short, I've been working as ... for ... years.", 'My notice period is one month.', "I'm looking for something in the range of ...", 'What would the next steps be?'],
  },
  {
    id: 'ph-bank',
    kind: 'phone',
    level: 'B2',
    scenario: { title: 'Disputing a bank charge', setting: 'You call your bank about a charge you did not make', aiRole: 'a bank fraud department agent who must verify your identity', userRole: 'the account holder', userGoal: 'report the charge, answer security questions, and get the card blocked and the money refunded' },
    phrases: ["There's a charge on my card that I didn't make.", 'It was for ... on ...', 'Could you block the card, please?', 'How long will the refund take?'],
  },
];

export const SMALLTALK_SCENARIOS: ExtraScenario[] = [
  {
    id: 'st-coffee',
    kind: 'smalltalk',
    level: 'A2',
    scenario: { title: 'Conference coffee break', setting: 'the coffee line at an industry conference', aiRole: 'a friendly attendee from another company', userRole: 'yourself', userGoal: 'start a conversation, find out what they do, and find one thing in common' },
    phrases: ['Is this your first time at this conference?', 'So, what brings you here?', 'What do you do, if you don\'t mind me asking?', 'Oh, really? How did you get into that?', 'Same here!'],
  },
  {
    id: 'st-elevator',
    kind: 'smalltalk',
    level: 'B1',
    scenario: { title: 'Elevator with a senior leader', setting: 'a two-minute elevator ride with a senior director you have never met', aiRole: 'a senior director who is friendly but busy', userRole: 'yourself', userGoal: 'introduce yourself briefly, say what you work on, and leave a good impression' },
    phrases: ["Hi, I don't think we've met. I'm ...", "I'm on the ... team; we're working on ...", 'How is your week going?', 'It was great to meet you.'],
  },
  {
    id: 'st-dinner',
    kind: 'smalltalk',
    level: 'B2',
    scenario: { title: 'Client dinner', setting: 'a relaxed dinner with a client after a successful meeting', aiRole: 'the client, who likes travel and food', userRole: 'the host', userGoal: 'keep the conversation going on non-work topics, ask good follow-up questions, and share a short story of your own' },
    phrases: ['Have you been to this city before?', 'What do you usually do on weekends?', 'That reminds me of ...', 'How did you get into that?', "I'd love to try that sometime."],
  },
  {
    id: 'st-names',
    kind: 'smalltalk',
    level: 'B1',
    scenario: { title: 'Networking: names and follow-ups', setting: 'a networking event where people introduce themselves quickly', aiRole: 'a talkative professional who mentions several details about themselves', userRole: 'yourself', userGoal: 'use their name, remember two details, and ask follow-up questions about them' },
    phrases: ['Sorry, could you tell me your name again?', 'Nice to meet you, ... .', "You mentioned you ... — how's that going?", 'What does that involve, exactly?'],
  },
  {
    id: 'st-exit',
    kind: 'smalltalk',
    level: 'B2',
    scenario: { title: 'Ending a conversation politely', setting: 'a networking event; you have been talking to the same person for a while and need to move on', aiRole: 'a person who loves to keep talking', userRole: 'yourself', userGoal: 'end the conversation politely and naturally, and suggest staying in touch' },
    phrases: ["It's been really great talking to you.", "I'm going to grab another coffee, but ...", 'Shall we connect on LinkedIn?', 'I should go and say hello to a colleague.', 'Enjoy the rest of the event!'],
  },
  {
    id: 'st-monday',
    kind: 'smalltalk',
    level: 'A2',
    scenario: { title: 'Monday morning chat', setting: 'the office kitchen on Monday morning', aiRole: 'a colleague you know a little', userRole: 'yourself', userGoal: 'ask about their weekend, share something about yours, and keep it going for a few turns' },
    phrases: ['How was your weekend?', 'Did you do anything fun?', 'Oh, nice! Where did you go?', 'Not much, I just relaxed.'],
  },
];

export const scenarioById = (id: string) => [...PHONE_SCENARIOS, ...SMALLTALK_SCENARIOS].find((s) => s.id === id);

export const DEBATE_MOTIONS: { level: Level; motion: string }[] = [
  { level: 'A2', motion: 'It is better to live in a city than in the countryside.' },
  { level: 'A2', motion: 'Children should have a smartphone before they are twelve.' },
  { level: 'B1', motion: 'Working from home is better than working in an office.' },
  { level: 'B1', motion: 'Everyone should learn to code at school.' },
  { level: 'B1', motion: 'Social media does more harm than good.' },
  { level: 'B1', motion: 'A four-day work week should be the norm.' },
  { level: 'B2', motion: 'Companies should be required to publish everyone\'s salary.' },
  { level: 'B2', motion: 'University education should be free for everyone.' },
  { level: 'B2', motion: 'Artificial intelligence will create more jobs than it destroys.' },
  { level: 'B2', motion: 'It is better to work for a startup than a big company.' },
  { level: 'C1', motion: 'Meetings waste more time than they save.' },
  { level: 'C1', motion: 'Governments should tax sugary drinks heavily.' },
  { level: 'C1', motion: 'Performance reviews should be abolished.' },
  { level: 'C2', motion: 'Remote work is making companies less innovative.' },
  { level: 'C2', motion: 'Standardized tests like the TOEFL are a fair way to measure language ability.' },
];
