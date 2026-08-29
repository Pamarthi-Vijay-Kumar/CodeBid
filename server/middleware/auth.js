const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../utils/token');
const User = require('../models/User');
const Team = require('../models/Team');

// Authenticates either a User (super admin / organizer / spectator-account) or a Team login.
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new ApiError(401, 'Authentication required.');

    const decoded = verifyToken(token);

    if (decoded.type === 'TEAM') {
      const team = await Team.findById(decoded.id);
      if (!team || team.status === 'DISQUALIFIED') throw new ApiError(401, 'Invalid session.');
      req.auth = { type: 'TEAM', teamId: team._id, eventId: team.eventId, team };
    } else {
      const user = await User.findById(decoded.id);
      if (!user || !user.isActive) throw new ApiError(401, 'Invalid session.');
      req.auth = { type: 'USER', userId: user._id, role: user.role, user };
    }
    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    next(new ApiError(401, 'Invalid or expired session.'));
  }
}

// Restrict to specific user roles (SUPER_ADMIN / ORGANIZER / SPECTATOR).
function requireRole(...roles) {
  return (req, res, next) => {
    if (req.auth?.type !== 'USER' || !roles.includes(req.auth.role)) {
      return next(new ApiError(403, 'You do not have permission to perform this action.'));
    }
    next();
  };
}

// Restrict to authenticated teams only.
function requireTeam(req, res, next) {
  if (req.auth?.type !== 'TEAM') {
    return next(new ApiError(403, 'Team access only.'));
  }
  next();
}

module.exports = { requireAuth, requireRole, requireTeam };
