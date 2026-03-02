const userService = require('../services/user.service');
const { success } = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');

const assignRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role, reason } = req.body;

  const user = await userService.assignRole({
    targetUserId: id,
    newRole: role,
    changedBy: req.user.id,
    reason,
  });

  res.json(success(user, 'Role updated successfully'));
});

module.exports = {
  assignRole,
};
