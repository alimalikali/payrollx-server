/**
 * Settings Controller
 */

const settingsService = require('../services/settings.service');
const { success } = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');

const getSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.getSettings();

  res.json(success(settings));
});

const updateSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.updateSettings(req.body);

  res.json(success(settings, 'Settings updated successfully'));
});

const getPublicHolidays = asyncHandler(async (req, res) => {
  const { year } = req.query;
  const holidays = await settingsService.getPublicHolidays(parseInt(year));

  res.json(success(holidays));
});

const addPublicHoliday = asyncHandler(async (req, res) => {
  const holiday = await settingsService.addPublicHoliday(req.body);

  res.status(201).json(success(holiday, 'Holiday added successfully'));
});

const deletePublicHoliday = asyncHandler(async (req, res) => {
  await settingsService.deletePublicHoliday(req.params.id);

  res.json(success(null, 'Holiday deleted successfully'));
});

module.exports = {
  getSettings,
  updateSettings,
  getPublicHolidays,
  addPublicHoliday,
  deletePublicHoliday,
};
