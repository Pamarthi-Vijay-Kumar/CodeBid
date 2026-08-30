// Quick-start seed script: creates a demo organizer, a live-ready event,
// a small question bank, and 4 teams so you can see the whole flow immediately.
// Run with: npm run seed
require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');
const Event = require('../models/Event');
const Question = require('../models/Question');
const EventQuestion = require('../models/EventQuestion');
const Team = require('../models/Team');
const Transaction = require('../models/Transaction');

async function run() {
  await connectDB();

  const organizer = await User.findOneAndUpdate(
    { email: 'organizer@codebid.dev' },
    { name: 'Demo Organizer', email: 'organizer@codebid.dev', password: 'password123', role: 'ORGANIZER' },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  let event = await Event.findOne({ name: 'CodeBid 2026 - Demo' });
  if (!event) {
    event = await Event.create({
      organizerId: organizer._id,
      name: 'CodeBid 2026 - Demo',
      description: 'A sample event to explore the CodeBid platform.',
      venue: 'Main Auditorium',
      eventDate: new Date(),
      maxTeams: 60,
      startingBalance: 10000,
      minimumBid: 500,
      bidIncrement: 100,
      biddingDurationSec: 30,
      answerDurationSec: 20,
      status: 'DRAFT',
    });
  }

  const sampleQuestions = [
    { category: 'Java', topic: 'Strings', difficulty: 'HARD', questionType: 'MCQ',
      questionText: 'What is the output of: System.out.println("Hello".equals("HELLO"));',
      options: ['true', 'false', 'Compilation Error', 'Runtime Error'], correctAnswer: 'false' },
    { category: 'DSA', topic: 'Arrays', difficulty: 'MEDIUM', questionType: 'MCQ',
      questionText: 'Time complexity of binary search on a sorted array?',
      options: ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'], correctAnswer: 'O(log n)' },
    { category: 'SQL', topic: 'Joins', difficulty: 'EASY', questionType: 'MCQ',
      questionText: 'Which JOIN returns all rows from both tables, matched where possible?',
      options: ['INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL OUTER JOIN'], correctAnswer: 'FULL OUTER JOIN' },
    { category: 'Python', topic: 'Data Types', difficulty: 'EXPERT', questionType: 'CODE_OUTPUT',
      questionText: 'What does print(type([]) == list) output?',
      options: ['True', 'False', 'Error', 'None'], correctAnswer: 'True' },
  ];

  for (const q of sampleQuestions) {
    const exists = await Question.findOne({ ownerId: organizer._id, questionText: q.questionText });
    if (!exists) {
      const created = await Question.create({ ...q, ownerId: organizer._id });
      const count = await EventQuestion.countDocuments({ eventId: event._id });
      await EventQuestion.create({ eventId: event._id, questionId: created._id, order: count + 1 });
    }
  }

  const teamNames = ['Code Warriors', 'Java Masters', 'Bug Hunters', 'Code Ninjas'];
  for (const teamName of teamNames) {
    const exists = await Team.findOne({ eventId: event._id, teamName });
    if (!exists) {
      const team = await Team.create({
        eventId: event._id,
        teamName,
        members: ['Member A', 'Member B'],
        captainName: `${teamName} Captain`,
        captainEmail: `${teamName.toLowerCase().replace(/\s+/g, '.')}@codebid.dev`,
        password: 'team1234',
        startingBalance: event.startingBalance,
        currentBalance: event.startingBalance,
      });
      await Transaction.create({
        eventId: event._id, teamId: team._id, type: 'INITIAL_BALANCE',
        amount: event.startingBalance, balanceAfter: event.startingBalance, note: 'Starting balance',
      });
    }
  }

  console.log('--------------------------------------------------');
  console.log('Seed complete.');
  console.log('Organizer login: organizer@codebid.dev / password123');
  console.log(`Event ID: ${event._id}`);
  console.log('Team login (event-scoped): teamName = e.g. "Code Warriors", password = team1234');
  console.log('--------------------------------------------------');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
