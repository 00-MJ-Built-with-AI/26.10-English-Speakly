/** Test-mode samples for each TOEFL task (written for this app), used until the AI key is added. */
import type { GenKind, GenOut } from '../../shared/toefl.ts';

export const TOEFL_SAMPLES: { [K in GenKind]: GenOut<K> } = {
  complete: {
    title: 'Coral reefs',
    text: 'Coral reefs cover less than one percent of the ocean floor. However, they support about a quarter of all marine species. Reefs are built by tiny animals that produce hard skeletons over thousands of years. When water temperatures rise, corals often lose the algae that live inside them and provide most of their energy. This process, known as bleaching, can kill large areas of reef within a single season.',
    words: ['support', 'quarter', 'marine', 'built', 'animals', 'produce', 'thousands', 'temperatures', 'provide', 'process'],
  },
  daily: {
    format: 'notice',
    title: 'Library hours change',
    text: 'Starting Monday, March 4, the Main Library will close at 10 p.m. instead of midnight on weekdays while the third floor is being renovated. Group study rooms on the second floor can still be booked online, up to three days in advance. Students who need a quiet place after 10 p.m. may use the 24-hour study hall in the Student Center.',
    questions: [
      { question: 'Why is the library changing its hours?', options: ['Fewer students use it at night', 'Part of the building is being renovated', 'It is saving money on staff', 'The Student Center is opening'], answer: 1, type: 'detail', explanation: 'The notice says the third floor is being renovated.' },
      { question: 'What can students still do?', options: ['Study on the third floor', 'Stay in the library until midnight', 'Book group study rooms online', 'Book rooms a week in advance'], answer: 2, type: 'detail', explanation: 'Group study rooms can still be booked online.' },
      { question: 'What is suggested about the study hall in the Student Center?', options: ['It is open all night', 'It closes at 10 p.m.', 'It must be booked', 'It is being renovated'], answer: 0, type: 'inference', explanation: 'It is called a 24-hour study hall and is offered for after 10 p.m.' },
    ],
  },
  academic: {
    title: 'The invention of the printing press',
    text: "Before the fifteenth century, books in Europe were copied by hand, a slow process that made them rare and expensive. Around 1440, Johannes Gutenberg developed a press that used movable metal type, allowing pages to be printed quickly and in large numbers. The effects were dramatic. Within fifty years, millions of books had been printed, and the price of books fell sharply. Literacy spread beyond the clergy and the wealthy, and new ideas could circulate across countries in months rather than decades. Some historians argue that the printing press made the scientific revolution possible, because scientists could now compare and build on each other's published results. Others caution that the change was gradual: many people still could not read, and handwritten manuscripts remained common for certain purposes for another century.",
    questions: [
      { question: 'What is the passage mainly about?', options: ['How Gutenberg built his first press', 'The effects of the printing press on European society', 'Why handwritten books were better', 'The history of the clergy'], answer: 1, type: 'main-idea', explanation: 'Most of the passage describes the effects of printing.' },
      { question: 'According to the passage, what happened within fifty years?', options: ['Handwritten books disappeared', 'Millions of books were printed', 'Everyone learned to read', 'Science stopped changing'], answer: 1, type: 'detail', explanation: 'The text says millions of books had been printed.' },
      { question: 'The word "circulate" is closest in meaning to', options: ['disappear', 'spread', 'repeat', 'compete'], answer: 1, type: 'vocabulary', explanation: 'Ideas could spread across countries.' },
      { question: 'Why does the author mention the scientific revolution?', options: ['To show one major effect some historians link to printing', 'To explain how the press was invented', 'To argue that scientists opposed printing', 'To describe the clergy'], answer: 0, type: 'purpose', explanation: 'It is given as an effect some historians attribute to printing.' },
      { question: 'What can be inferred from the last sentence?', options: ['Printing ended handwriting immediately', 'The impact of printing took time to reach everyone', 'Manuscripts were cheaper than books', 'Historians agree completely'], answer: 1, type: 'inference', explanation: 'It says the change was gradual.' },
    ],
  },
  response: {
    items: [
      { prompt: 'Do you know if the bookstore is open on Saturdays?', options: ['Yes, I bought two books.', "I think it's open until noon.", "It's on the second floor.", 'No, I prefer Sundays.'], answer: 1, explanation: 'It answers the question about opening on Saturdays.' },
      { prompt: "I can't find my student ID anywhere.", options: ['Have you checked your backpack?', 'My ID number is long.', 'The library is quiet.', 'Yes, I found it.'], answer: 0, explanation: 'A helpful reply to a lost item.' },
      { prompt: 'Would you mind if I borrowed your notes from Tuesday?', options: ['Tuesday is my busiest day.', 'Not at all, here you go.', 'I take notes by hand.', "No, it wasn't on Tuesday."], answer: 1, explanation: '"Not at all" agrees to the request.' },
      { prompt: 'How did your presentation go?', options: ['At three o\'clock.', 'Better than I expected, actually.', 'In room 204.', "I'll present next week."], answer: 1, explanation: 'It describes how it went.' },
    ],
  },
  conversation: {
    title: 'Changing a lab section',
    lines: [
      { speaker: 'man', text: "Hi, I'm hoping to switch my chemistry lab section. Is that possible?" },
      { speaker: 'woman', text: 'It depends. Which section are you in now?' },
      { speaker: 'man', text: "The Thursday morning one. I just got a part-time job, and I have to work Thursdays." },
      { speaker: 'woman', text: 'I see. The Monday afternoon section still has two seats, but the Wednesday one is full.' },
      { speaker: 'man', text: 'Monday afternoon would be perfect. What do I need to do?' },
      { speaker: 'woman', text: "Fill out this change form and get your lab instructor to sign it. Then bring it back here by Friday." },
      { speaker: 'man', text: "Great. I'll email my instructor today." },
      { speaker: 'woman', text: "Just remember, if the form isn't in by Friday, the seat goes to the next person on the list." },
    ],
    questions: [
      { question: 'Why does the man want to change his lab section?', options: ['He failed the last lab', 'He has to work on Thursdays', 'He prefers a different instructor', 'His class is too large'], answer: 1, type: 'detail', explanation: 'He has a new part-time job on Thursdays.' },
      { question: 'What will the man probably do next?', options: ['Go to the Wednesday lab', 'Contact his lab instructor', 'Quit his job', 'Wait for a seat to open'], answer: 1, type: 'inference', explanation: 'He says he will email his instructor today.' },
      { question: 'What does the woman warn him about?', options: ['The Monday section may lose his seat if he is late with the form', 'The form costs money', 'Labs on Monday are harder', 'He must change his major'], answer: 0, type: 'detail', explanation: 'The seat goes to the next person if the form is late.' },
    ],
  },
  announcement: {
    title: 'Career fair',
    speaker: 'Career center director',
    text: "Good morning, everyone. Just a reminder that the spring career fair takes place next Wednesday from ten to four in the sports center. More than sixty companies will be there, including several engineering and technology firms looking for summer interns. Please bring printed copies of your résumé, and if you'd like someone to look at it first, the career center is offering fifteen-minute résumé reviews every afternoon this week. You don't need an appointment; just come by our office on the first floor of the administration building.",
    questions: [
      { question: 'What is the main purpose of the announcement?', options: ['To announce a new internship program', 'To remind students about a career fair and offer help preparing', 'To change the location of the career fair', 'To introduce a new director'], answer: 1, type: 'purpose', explanation: 'It reminds students of the fair and offers résumé reviews.' },
      { question: 'Where will the career fair take place?', options: ['In the administration building', 'In the sports center', 'In the career center', 'Online'], answer: 1, type: 'detail', explanation: 'In the sports center.' },
      { question: 'What should students do to get a résumé review?', options: ['Book an appointment online', 'Email the director', 'Visit the career center office in the afternoon', 'Wait until the fair'], answer: 2, type: 'detail', explanation: 'No appointment needed; come by in the afternoon.' },
    ],
  },
  talk: {
    title: 'Why some birds migrate at night',
    text: "Okay, so last time we talked about how far some birds travel during migration. Today I want to look at a question that surprises a lot of students: why do so many songbirds migrate at night? You'd think daytime would be easier, right? They can see. But there are a few good reasons. First, the air is usually cooler and calmer at night, so birds lose less water and use less energy flying. Second, many predators, like hawks, hunt during the day, so flying in the dark is safer. And third, and this is the interesting part, many birds use the stars to navigate. Experiments in the 1960s placed young birds in a planetarium, a room where the night sky is projected on the ceiling. When the researchers rotated the projected stars, the birds changed the direction they tried to fly. So night flight isn't a strange choice at all; it's actually quite efficient. Of course, it has costs too. Birds have to feed during the day, so they get less rest.",
    questions: [
      { question: 'What is the talk mainly about?', options: ['How far birds migrate', 'Reasons many songbirds migrate at night', 'How planetariums work', 'Which birds are predators'], answer: 1, type: 'main-idea', explanation: 'The professor explains why songbirds migrate at night.' },
      { question: 'According to the professor, why is night flying safer?', options: ['Birds can see better', 'Many predators hunt during the day', 'The stars frighten predators', 'It is warmer'], answer: 1, type: 'detail', explanation: 'Hawks and other predators hunt by day.' },
      { question: 'Why does the professor mention the planetarium experiment?', options: ['To show that birds use the stars to navigate', 'To describe a popular attraction', 'To explain why birds sleep', 'To criticize old research'], answer: 0, type: 'purpose', explanation: 'Rotating the stars changed the birds\' direction.' },
      { question: 'What is the professor\'s attitude toward night migration?', options: ['She thinks it is a strange choice', 'She sees it as efficient despite some costs', 'She thinks it is dangerous', 'She is unsure it happens'], answer: 1, type: 'attitude', explanation: 'She calls it efficient but notes the cost of less rest.' },
    ],
  },
  build: {
    items: [
      { context: 'What did the professor say about the deadline?', answer: 'She said that we could submit it next Monday.', chunks: ['She said', 'that', 'we could', 'submit it', 'next Monday'] },
      { context: 'Why were you late this morning?', answer: 'The bus that I usually take was cancelled.', chunks: ['The bus', 'that I', 'usually take', 'was', 'cancelled'] },
      { context: 'Do you know where the meeting is?', answer: 'I am not sure where they are holding it.', chunks: ['I am', 'not sure', 'where', 'they are', 'holding it'] },
      { context: 'Is the new lab ready?', answer: 'It has not been finished yet, unfortunately.', chunks: ['It has', 'not been', 'finished', 'yet,', 'unfortunately'] },
    ],
  },
  email: {
    situation: 'You missed an important class because you were sick, and there was a short quiz that day.',
    to: 'Professor Lin',
    points: ['Explain why you missed the class', 'Ask whether you can take the quiz another time', 'Ask how you can get the notes from that day'],
  },
  discussion: {
    course: 'Introduction to Education',
    professor: 'This week we are discussing technology in schools. Some schools now give every student a tablet and use digital textbooks instead of paper ones. Do you think digital textbooks are better for students than paper textbooks? Why or why not?',
    posts: [
      { name: 'Sara', text: 'I think digital textbooks are better. They are lighter, cheaper to update, and they can include videos and quizzes that help students understand difficult ideas.' },
      { name: 'Omar', text: 'I prefer paper textbooks. Research suggests students remember more when they read on paper, and tablets can distract students with games and messages.' },
    ],
  },
};
