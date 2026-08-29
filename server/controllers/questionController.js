const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Question = require('../models/Question');
const EventQuestion = require('../models/EventQuestion');

// --- Question Bank (Section 34) - reusable, not tied to one event ---

exports.createQuestion = asyncHandler(async (req, res) => {
  const q = await Question.create({ ...req.body, ownerId: req.auth.userId });
  res.status(201).json({ success: true, question: q });
});

exports.listBankQuestions = asyncHandler(async (req, res) => {
  const { category, topic, difficulty, search } = req.query;
  const filter = { ownerId: req.auth.userId };
  if (category) filter.category = category;
  if (topic) filter.topic = topic;
  if (difficulty) filter.difficulty = difficulty;
  if (search) filter.questionText = { $regex: search, $options: 'i' };
  const questions = await Question.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, questions });
});

exports.updateQuestion = asyncHandler(async (req, res) => {
  const q = await Question.findOne({ _id: req.params.questionId, ownerId: req.auth.userId });
  if (!q) throw new ApiError(404, 'Question not found.');
  Object.assign(q, req.body);
  await q.save();
  res.json({ success: true, question: q });
});

exports.deleteQuestion = asyncHandler(async (req, res) => {
  const q = await Question.findOneAndDelete({ _id: req.params.questionId, ownerId: req.auth.userId });
  if (!q) throw new ApiError(404, 'Question not found.');
  res.json({ success: true });
});

exports.duplicateQuestion = asyncHandler(async (req, res) => {
  const q = await Question.findOne({ _id: req.params.questionId, ownerId: req.auth.userId }).select('+correctAnswer');
  if (!q) throw new ApiError(404, 'Question not found.');
  const clone = q.toObject();
  delete clone._id;
  clone.questionText = `${clone.questionText} (copy)`;
  const created = await Question.create(clone);
  res.status(201).json({ success: true, question: created });
});

// Bulk import via JSON array (validated). CSV parsing should happen client-side
// or via a small parser before hitting this endpoint with normalized JSON.
exports.importQuestions = asyncHandler(async (req, res) => {
  const { questions } = req.body;
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new ApiError(400, 'Provide a non-empty array of questions.');
  }

  const errors = [];
  const valid = [];
  questions.forEach((q, idx) => {
    const rowErrors = [];
    if (!q.questionText) rowErrors.push('questionText is required');
    if (!q.category) rowErrors.push('category is required');
    if (!q.topic) rowErrors.push('topic is required');
    if (!['EASY', 'MEDIUM', 'HARD', 'EXPERT'].includes(q.difficulty)) rowErrors.push('invalid difficulty');
    if (!q.correctAnswer) rowErrors.push('correctAnswer is required');
    if (rowErrors.length) errors.push({ row: idx + 1, errors: rowErrors });
    else valid.push({ ...q, ownerId: req.auth.userId, questionType: q.questionType || 'MCQ' });
  });

  const created = valid.length ? await Question.insertMany(valid) : [];
  res.status(errors.length ? 207 : 201).json({ success: true, created: created.length, errors });
});

// --- Event Question selection (Section 34/7) ---

exports.addQuestionToEvent = asyncHandler(async (req, res) => {
  if (req.event.isLocked) throw new ApiError(409, 'Event is locked. Pause it to modify questions.');
  const { questionId, rewardMultiplierOverride, answerDurationOverrideSec, isChampionshipQuestion } = req.body;

  const q = await Question.findOne({ _id: questionId, ownerId: req.auth.userId });
  if (!q) throw new ApiError(404, 'Question not found in your bank.');

  const count = await EventQuestion.countDocuments({ eventId: req.event._id });
  const eq = await EventQuestion.create({
    eventId: req.event._id,
    questionId,
    order: count + 1,
    rewardMultiplierOverride: rewardMultiplierOverride ?? null,
    answerDurationOverrideSec: answerDurationOverrideSec ?? null,
    isChampionshipQuestion: Boolean(isChampionshipQuestion),
  });
  res.status(201).json({ success: true, eventQuestion: eq });
});

exports.removeQuestionFromEvent = asyncHandler(async (req, res) => {
  if (req.event.isLocked) throw new ApiError(409, 'Event is locked. Pause it to modify questions.');
  const eq = await EventQuestion.findOneAndDelete({ _id: req.params.eventQuestionId, eventId: req.event._id });
  if (!eq) throw new ApiError(404, 'Question is not part of this event.');
  res.json({ success: true });
});

exports.reorderEventQuestions = asyncHandler(async (req, res) => {
  if (req.event.isLocked) throw new ApiError(409, 'Event is locked. Pause it to reorder questions.');
  const { orderedEventQuestionIds } = req.body;
  await Promise.all(
    orderedEventQuestionIds.map((id, idx) =>
      EventQuestion.updateOne({ _id: id, eventId: req.event._id }, { order: idx + 1 })
    )
  );
  res.json({ success: true });
});

exports.listEventQuestions = asyncHandler(async (req, res) => {
  const eqs = await EventQuestion.find({ eventId: req.event._id })
    .sort({ order: 1 })
    .populate({ path: 'questionId', select: '-correctAnswer' });
  res.json({ success: true, questions: eqs });
});
