const ApiError = require('../utils/ApiError');
const Event = require('../models/Event');

// Section 52: every event-scoped route must verify eventId and that the
// caller actually belongs to / owns that event. Never let Event A data
// leak into an Event B request.
module.exports = async function eventScope(req, res, next) {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId);
    if (!event) throw new ApiError(404, 'Event not found.');

    if (req.auth.type === 'TEAM' && String(req.auth.eventId) !== String(event._id)) {
      throw new ApiError(403, 'This team does not belong to this event.');
    }
    if (req.auth.type === 'USER' && req.auth.role === 'ORGANIZER' && String(event.organizerId) !== String(req.auth.userId)) {
      throw new ApiError(403, 'You do not manage this event.');
    }

    req.event = event;
    next();
  } catch (err) {
    next(err instanceof ApiError ? err : new ApiError(500, 'Could not verify event access.'));
  }
};
