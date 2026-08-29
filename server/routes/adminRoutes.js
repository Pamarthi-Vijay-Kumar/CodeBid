const router = require('express').Router();
const ctrl = require('../controllers/adminController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth, requireRole('SUPER_ADMIN'));

router.get('/stats', ctrl.platformStats);
router.get('/organizers', ctrl.listOrganizers);
router.patch('/users/:userId/active', ctrl.setUserActive);
router.get('/events', ctrl.listAllEvents);

module.exports = router;
