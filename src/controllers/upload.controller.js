const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { success } = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');
const { BadRequestError } = require('../utils/errors');

const MAX_PROFILE_PHOTO_SIZE_BYTES = 2 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const getUploadsRoot = () => path.join(__dirname, '..', '..', 'uploads');

const saveProfilePhoto = asyncHandler(async (req, res) => {
  const { fileName, contentType, data } = req.body || {};
  const extension = SUPPORTED_IMAGE_TYPES[contentType];

  if (!fileName || !contentType || !data) {
    throw new BadRequestError('fileName, contentType and data are required');
  }

  if (!extension) {
    throw new BadRequestError('Unsupported file type. Allowed types: jpeg, png, webp');
  }

  const base64Payload = String(data).includes(',')
    ? String(data).split(',').pop()
    : String(data);

  const buffer = Buffer.from(base64Payload, 'base64');
  if (!buffer || buffer.length === 0) {
    throw new BadRequestError('Invalid file data');
  }

  if (buffer.length > MAX_PROFILE_PHOTO_SIZE_BYTES) {
    throw new BadRequestError('Profile photo must be 2MB or less');
  }

  const safeBaseName = String(fileName)
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60) || 'profile';

  const profileDir = path.join(getUploadsRoot(), 'profiles');
  await fs.mkdir(profileDir, { recursive: true });

  const storedFileName = `${safeBaseName}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${extension}`;
  const absolutePath = path.join(profileDir, storedFileName);

  await fs.writeFile(absolutePath, buffer);

  const fileKey = `profiles/${storedFileName}`;
  const url = `/uploads/${fileKey}`;

  res.status(201).json(success({ fileKey, url }, 'Profile photo uploaded'));
});

module.exports = {
  saveProfilePhoto,
};
