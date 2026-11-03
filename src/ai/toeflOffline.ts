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
  paraphrase: {
    items: [
      {
        sentence: 'Because the new vaccine must be kept at very low temperatures, it has been difficult to deliver to rural clinics that lack reliable electricity.',
        options: [
          'Rural clinics have refused the new vaccine because it is too cold.',
          'Getting the vaccine to rural clinics is hard, since it needs freezing storage that depends on steady power.',
          'The new vaccine works better in rural areas with reliable electricity.',
          'Low temperatures in rural areas have made the vaccine difficult to produce.',
        ],
        answer: 1,
        explanation: 'Only B keeps the cause (cold storage) and the effect (hard delivery). A adds a refusal, C changes the claim, D changes delivery to production.',
      },
      {
        sentence: 'Although early critics dismissed the novel as too long, it has since become one of the most widely taught books in American high schools.',
        options: [
          'Critics have always praised the novel, which is now taught widely.',
          'The novel is taught in many schools because critics said it was long.',
          'Despite first being criticized for its length, the novel is now taught very widely in American high schools.',
          'Most American high school students find the novel too long.',
        ],
        answer: 2,
        explanation: 'C keeps the contrast. A removes the early criticism, B invents a cause, D is about students, not critics.',
      },
      {
        sentence: 'Some economists argue that a modest increase in the minimum wage may reduce employee turnover without significantly raising unemployment.',
        options: [
          'Economists agree that a higher minimum wage will reduce turnover.',
          'According to some economists, a small rise in the minimum wage could keep workers in their jobs longer while not greatly increasing unemployment.',
          'A large increase in the minimum wage raises unemployment, some economists argue.',
          'Raising the minimum wage reduces unemployment, according to economists.',
        ],
        answer: 1,
        explanation: 'B keeps "some", "modest/small", "may/could" and both effects. A says all agree, C says "large", D reverses the unemployment point.',
      },
    ],
  },
  vocab: {
    items: [
      { word: 'allocate', sentence: 'The university decided to allocate more funding to student mental health services.', meaning: 'to give or set aside for a purpose', options: ['to remove', 'to give or set aside for a purpose', 'to delay', 'to measure'], answer: 1 },
      { word: 'inherent', sentence: 'There are risks inherent in any new medical procedure.', meaning: 'existing as a natural, basic part', options: ['hidden and secret', 'added later', 'existing as a natural, basic part', 'easy to avoid'], answer: 2 },
      { word: 'subsequent', sentence: 'The first trial failed, but subsequent experiments confirmed the theory.', meaning: 'coming after', options: ['coming after', 'earlier', 'unrelated', 'expensive'], answer: 0 },
      { word: 'derive', sentence: 'Many English words derive from Latin and Greek.', meaning: 'to come from a source', options: ['to replace', 'to come from a source', 'to translate badly', 'to disappear'], answer: 1 },
      { word: 'comprise', sentence: 'The committee comprises five professors and two students.', meaning: 'to be made up of', options: ['to argue with', 'to elect', 'to be made up of', 'to exclude'], answer: 2 },
      { word: 'notion', sentence: 'The notion that the Earth was flat was common in some ancient cultures.', meaning: 'an idea or belief', options: ['a proof', 'an idea or belief', 'a law', 'a map'], answer: 1 },
    ],
  },
  spelling: {
    items: [
      { sentence: 'The rapid ____ of new technology has changed how students learn.', base: 'develop', answer: 'development', rule: 'verb + -ment makes a noun; no letter changes.' },
      { sentence: 'Several ____ have studied the effects of sleep on memory.', base: 'study', answer: 'studies', rule: 'consonant + y: change y to i and add -es.' },
      { sentence: 'The results were ____ different from what the team expected.', base: 'surprising', answer: 'surprisingly', rule: 'adjective + -ly makes an adverb.' },
      { sentence: 'The museum ____ the exhibit last month because of repairs.', base: 'stop', answer: 'stopped', rule: 'one vowel + one consonant at the end of a short verb: double it before -ed.' },
      { sentence: 'Good ____ between team members is essential.', base: 'communicate', answer: 'communication', rule: 'verbs ending in -ate drop the e and add -ion.' },
      { sentence: 'The ____ of the bridge is about 300 meters.', base: 'long', answer: 'length', rule: 'some adjectives have irregular noun forms (long - length, strong - strength).' },
    ],
  },
  dictation: {
    items: [
      { sentence: "I'm going to drop by the registrar's office before my two o'clock class." },
      { sentence: 'If you want to borrow the lab equipment, you have to sign it out at the front desk.' },
      { sentence: 'The professor said the midterm would cover chapters three through seven.' },
      { sentence: 'Could you send me the slides from Tuesday? I missed the first half of the lecture.' },
      { sentence: 'Most of the energy in this ecosystem comes from tiny organisms near the surface.' },
    ],
  },
  notes: {
    title: 'Why cities are warmer than the countryside',
    text: "Today I want to talk about something called the urban heat island effect. Basically, cities tend to be warmer than the rural areas around them, sometimes by three or four degrees, and the difference is biggest at night. So why does this happen? First, materials. Asphalt, concrete and brick absorb a lot of heat from the sun during the day and then release it slowly at night. A field or a forest doesn't store heat in the same way. Second, there's less vegetation in cities. Plants cool the air through a process called evapotranspiration - they release water, and that evaporation takes heat away. Fewer trees means less of that cooling. Third, human activity itself produces heat: cars, air conditioners, factories. Ironically, air conditioners make the outside air even warmer. Now, why does this matter? Well, hotter cities mean more energy use, worse air quality, and real health risks during heat waves, especially for elderly people. The good news is that cities can do something about it. For example, some cities paint roofs white so they reflect sunlight, and others plant trees along streets or build green roofs. Studies in several cities have found that these changes can lower surface temperatures noticeably. So the key point is that the heat island effect is largely caused by how we build cities, which means it can also be reduced by how we build them.",
    keyPoints: [
      'Urban heat island: cities warmer than countryside (3-4 degrees), most at night',
      'Cause 1: asphalt and concrete absorb heat, release it at night',
      'Cause 2: less vegetation, so less cooling by evapotranspiration',
      'Cause 3: heat from human activity (cars, AC, factories)',
      'Effects: energy use, air quality, health risk in heat waves',
      'Solutions: white roofs, trees, green roofs',
    ],
    questions: [
      { question: 'What is the lecture mainly about?', options: ['How to build air conditioners', 'Why cities are warmer than nearby rural areas and what can be done', 'The history of asphalt', 'Why rural areas are colder at night'], answer: 1, type: 'main-idea', explanation: 'The talk explains causes, effects and solutions of urban heat islands.' },
      { question: 'When is the temperature difference largest?', options: ['In the morning', 'At noon', 'At night', 'In winter'], answer: 2, type: 'detail', explanation: 'The professor says the difference is biggest at night.' },
      { question: 'Why does the professor mention air conditioners?', options: ['To show human activity adds heat outside', 'To recommend them for heat waves', 'To explain evapotranspiration', 'To compare cities and forests'], answer: 0, type: 'purpose', explanation: 'They cool inside but warm the outside air.' },
      { question: 'According to the lecture, how do plants cool the air?', options: ['By blocking wind', 'By releasing water that evaporates', 'By reflecting sunlight', 'By absorbing heat at night'], answer: 1, type: 'detail', explanation: 'Evapotranspiration: released water evaporates and takes heat away.' },
    ],
  },
  implied: {
    items: [
      { lines: [{ speaker: 'woman', text: 'Are you coming to the study group tonight?' }, { speaker: 'man', text: "I've got a paper due at nine tomorrow morning." }], question: 'What does the man imply?', options: ['He will come after nine', 'He probably will not come', 'He finished his paper', 'He wants to study the paper together'], answer: 1, explanation: 'He gives a reason he is busy instead of saying no directly.' },
      { lines: [{ speaker: 'man', text: 'Did you like the new cafeteria menu?' }, { speaker: 'woman', text: "Well, it's certainly... different." }], question: 'How does the woman feel about the menu?', options: ['She loves it', 'She has not tried it', 'She is not impressed', 'She thinks it is cheaper'], answer: 2, explanation: 'The pause and the vague word "different" politely hide a negative opinion.' },
      { lines: [{ speaker: 'woman', text: 'Professor Kim gave us an extra week for the project.' }, { speaker: 'man', text: "Now that's a relief!" }], question: 'What does the man mean?', options: ['He is worried about the project', 'He is glad about the extension', 'He wants another week', 'He already finished'], answer: 1, explanation: '"That\'s a relief" shows he is happy the pressure is lower.' },
    ],
  },
  interview: {
    topic: 'Technology and study habits',
    intro: "Hi, thanks for joining. I'd like to ask you a few questions about technology and studying.",
    questions: [
      'What kind of technology do you use most when you study?',
      'Do you prefer taking notes by hand or on a laptop? Why?',
      'Some people say smartphones make students less focused. Do you agree?',
      'Should universities limit the use of AI tools in assignments? Explain your view.',
    ],
    models: [
      "Mostly my laptop, honestly. I use it for reading articles, organizing my notes, and checking my schedule. For example, last semester I kept all my lab reports in one shared folder, so I could find old data really quickly. So for me, the laptop is basically my whole study desk.",
      "I prefer taking notes by hand. The main reason is that writing slowly forces me to summarize instead of copying every word. For instance, in my statistics class, I wrote short notes and diagrams, and I remembered the formulas much better on the exam. So even though typing is faster, handwriting works better for me.",
      "I mostly agree. Phones are designed to grab our attention, so even one notification can break your focus for several minutes. I noticed this myself: when I put my phone in another room, I finished a reading assignment in half the time. That said, phones can be useful for quick research, so the key is setting clear limits rather than banning them.",
      "I think universities should set clear limits, not ban AI completely. On one hand, students need to show their own thinking, especially in writing. On the other hand, AI is going to be part of almost every job. For example, a professor could allow AI for brainstorming but require students to explain their final argument themselves. So the goal should be teaching responsible use.",
    ],
  },
  tone: {
    items: [
      { reader: 'a professor', casual: 'Hey prof, I need the slides from Tuesday ASAP.', better: 'Dear Professor Lee, could you please share the slides from Tuesday\'s lecture when you have a moment?', tip: 'Formal greeting, a polite request instead of "I need", no "ASAP".' },
      { reader: 'the housing office', casual: 'My heater is broken. Fix it.', better: 'I am writing to report that the heater in my room is not working. Could someone please take a look at it this week?', tip: 'Explain the problem and ask politely with "Could someone please".' },
      { reader: 'an academic advisor', casual: "I wanna drop chem, is that ok or what?", better: 'I am thinking about dropping Chemistry 101, and I would appreciate your advice on whether that is a good idea.', tip: 'No "wanna" or "or what"; ask for advice.' },
      { reader: 'a classmate you do not know well', casual: 'Send me your notes.', better: 'Hi Sam, would you mind sharing your notes from Monday? I missed the class because I was sick.', tip: 'Add a greeting, "would you mind", and a reason.' },
    ],
  },
  longRepeat: {
    topic: 'Campus tour',
    sentences: [
      'The main library is open until midnight on weekdays during the semester.',
      'If you need a quiet place to study, try the reading room on the third floor.',
      "Students can print up to fifty pages a week for free using their campus ID card.",
      'The dining hall next to the student center serves breakfast, lunch and dinner every day of the week.',
      'Before you register for classes, make sure you have met with your academic advisor at least once this term.',
      'Lost items found anywhere on campus are taken to the security office near the main entrance, where you can collect them with your ID.',
    ],
  },
};
