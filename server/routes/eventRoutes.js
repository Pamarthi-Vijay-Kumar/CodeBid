const router = require('express').Router();
const ctrl = require('../controllers/eventController');
const teamCtrl = require('../controllers/teamController');
const questionCtrl = require('../controllers/questionController');
const competitionCtrl = require('../controllers/competitionController');
const answerCtrl = require('../controllers/answerController');
const txCtrl = require('../controllers/transactionController');
const reportCtrl = require('../controllers/reportController');
const bidCtrl = require('../controllers/bidController');

const { requireAuth, requireRole, requireTeam } = require('../middleware/auth');
const eventScope = require('../middleware/eventScope');

// Public
router.get('/public', ctrl.listPublicEvents);
router.get('/:eventId/registration-status', teamCtrl.registrationStatus);
router.post('/:eventId/teams/register', teamCtrl.selfRegisterTeam);

// Organizer/Admin
router.post('/', requireAuth, requireRole('ORGANIZER', 'SUPER_ADMIN'), ctrl.createEvent);
router.get('/', requireAuth, requireRole('ORGANIZER', 'SUPER_ADMIN'), ctrl.listMyEvents);

router.get('/:eventId', eventScope_public, ctrl.getEvent);
router.patch('/:eventId', requireAuth, requireRole('ORGANIZER', 'SUPER_ADMIN'), eventScope, ctrl.updateEvent);
router.get('/:eventId/checklist', requireAuth, requireRole('ORGANIZER', 'SUPER_ADMIN'), eventScope, ctrl.getLaunchChecklist);
router.post('/:eventId/launch', requireAuth, requireRole('ORGANIZER', 'SUPER_ADMIN'), eventScope, ctrl.launchEvent);
router.post('/:eventId/pause', requireAuth, requireRole('ORGANIZER', 'SUPER_ADMIN'), eventScope, ctrl.pauseEvent);
router.post('/:eventId/resume', requireAuth, requireRole('ORGANIZER', 'SUPER_ADMIN'), eventScope, ctrl.resumeEvent);
router.post('/:eventId/end', requireAuth, requireRole('ORGANIZER', 'SUPER_ADMIN'), eventScope, ctrl.endEvent);

// Teams (organizer-managed)
router.post('/:eventId/teams', requireAuth, requireRole('ORGANIZER', 'SUPER_ADMIN'), eventScope, teamCtrl.addTeam);
router.get('/:eventId/teams', requireAuth, eventScope, teamCtrl.listTeams);
router.post('/:eventId/teams/:teamId/disqualify', requireAuth, requireRole('ORGANIZER', 'SUPER_ADMIN'), eventScope, teamCtrl.disqualifyTeam);
router.post('/:eventId/teams/:teamId/adjust-balance', requireAuth, requireRole('ORGANIZER', 'SUPER_ADMIN'), eventScope, teamCtrl.adjustBalance);
router.get('/:eventId/teams/me', requireAuth, requireTeam, eventScope, teamCtrl.getMyTeamProfile);

// Event questions
router.post('/:eventId/questions', requireAuth, requireRole('ORGANIZER', 'SUPER_ADMIN'), eventScope, questionCtrl.addQuestionToEvent);
router.get('/:eventId/questions', requireAuth, eventScope, questionCtrl.listEventQuestions);
router.delete('/:eventId/questions/:eventQuestionId', requireAuth, requireRole('ORGANIZER', 'SUPER_ADMIN'), eventScope, questionCtrl.removeQuestionFromEvent);
router.post('/:eventId/questions/reorder', requireAuth, requireRole('ORGANIZER', 'SUPER_ADMIN'), eventScope, questionCtrl.reorderEventQuestions);

// Competition control (organizer)
router.post('/:eventId/competition/next-round', requireAuth, requireRole('ORGANIZER', 'SUPER_ADMIN'), eventScope, competitionCtrl.nextRound);
router.post('/:eventId/competition/start-bidding', requireAuth, requireRole('ORGANIZER', 'SUPER_ADMIN'), eventScope, competitionCtrl.startBidding);
router.post('/:eventId/competition/close-bidding', requireAuth, requireRole('ORGANIZER', 'SUPER_ADMIN'), eventScope, competitionCtrl.closeBidding);
router.post('/:eventId/competition/reveal-question', requireAuth, requireRole('ORGANIZER', 'SUPER_ADMIN'), eventScope, competitionCtrl.revealQuestion);
router.post('/:eventId/competition/force-timeout', requireAuth, requireRole('ORGANIZER', 'SUPER_ADMIN'), eventScope, answerCtrl.forceTimeout);
router.post('/:eventId/competition/skip-no-bids', requireAuth, requireRole('ORGANIZER', 'SUPER_ADMIN'), eventScope, answerCtrl.skipNoBidsRound);
router.post('/:eventId/competition/show-leaderboard', requireAuth, requireRole('ORGANIZER', 'SUPER_ADMIN'), eventScope, answerCtrl.showLeaderboard);
router.post('/:eventId/competition/pause', requireAuth, requireRole('ORGANIZER', 'SUPER_ADMIN'), eventScope, competitionCtrl.pauseCompetition);
router.post('/:eventId/competition/resume', requireAuth, requireRole('ORGANIZER', 'SUPER_ADMIN'), eventScope, competitionCtrl.resumeCompetition);

// Bidding & answering (teams)
router.post('/:eventId/bids', requireAuth, requireTeam, eventScope, bidCtrl.submitBid);
router.get('/:eventId/bids/mine', requireAuth, requireTeam, eventScope, bidCtrl.myBidStatus);
router.post('/:eventId/answers', requireAuth, requireTeam, eventScope, answerCtrl.submitAnswer);

// Leaderboard / transactions / results
router.get('/:eventId/leaderboard', eventScope_public, teamCtrl.eventLeaderboard);
router.get('/:eventId/transactions/mine', requireAuth, requireTeam, eventScope, txCtrl.myTransactions);
router.get('/:eventId/teams/:teamId/transactions', requireAuth, requireRole('ORGANIZER', 'SUPER_ADMIN'), eventScope, txCtrl.teamTransactions);
router.get('/:eventId/transactions', requireAuth, requireRole('ORGANIZER', 'SUPER_ADMIN'), eventScope, txCtrl.eventTransactions);
router.get('/:eventId/results', eventScope_public, reportCtrl.eventResults);
router.get('/:eventId/audit-logs', requireAuth, requireRole('ORGANIZER', 'SUPER_ADMIN'), eventScope, reportCtrl.auditLog);

// Leaderboard/results/spectator screen are public-readable (no sensitive data
// exposed there - Section 38); a light middleware just validates the event exists.
async function eventScope_public(req, res, next) {
  try {
    const Event = require('../models/Event');
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    req.event = event;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = router;
