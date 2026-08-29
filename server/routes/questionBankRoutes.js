const router = require('express').Router();
const ctrl = require('../controllers/questionController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth, requireRole('ORGANIZER', 'SUPER_ADMIN'));

router.post('/', ctrl.createQuestion);
router.get('/', ctrl.listBankQuestions);
router.patch('/:questionId', ctrl.updateQuestion);
router.delete('/:questionId', ctrl.deleteQuestion);
router.post('/:questionId/duplicate', ctrl.duplicateQuestion);
router.post('/import', ctrl.importQuestions);

module.exports = router;
