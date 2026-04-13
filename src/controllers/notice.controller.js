/**
 * Notice Controller
 * Handles HTTP requests for notice board
 */

const noticeService = require('../services/notice.service');
const { success } = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');

const getNotices = asyncHandler(async (req, res) => {
  const { page, limit, priority, category, search, pinnedOnly } = req.query;
  const result = await noticeService.getNotices({
    page: parseInt(page, 10) || 1,
    limit: parseInt(limit, 10) || 10,
    priority,
    category,
    search,
    pinnedOnly,
  });

  res.json(success(result.notices, null, result.pagination));
});

const getNotice = asyncHandler(async (req, res) => {
  const notice = await noticeService.getNoticeById(req.params.id);
  res.json(success(notice));
});

const createNotice = asyncHandler(async (req, res) => {
  const { title, content, priority, category, isPinned, expiresAt } = req.body;
  const notice = await noticeService.createNotice({
    title,
    content,
    priority,
    category,
    isPinned,
    expiresAt,
    createdBy: req.user.id,
  });

  res.status(201).json(success(notice, 'Notice created successfully'));
});

const updateNotice = asyncHandler(async (req, res) => {
  const { title, content, priority, category, isPinned, expiresAt } = req.body;
  const notice = await noticeService.updateNotice(req.params.id, {
    title,
    content,
    priority,
    category,
    isPinned,
    expiresAt,
  });

  res.json(success(notice, 'Notice updated successfully'));
});

const deleteNotice = asyncHandler(async (req, res) => {
  await noticeService.deleteNotice(req.params.id);
  res.json(success(null, 'Notice deleted successfully'));
});

module.exports = {
  getNotices,
  getNotice,
  createNotice,
  updateNotice,
  deleteNotice,
};
