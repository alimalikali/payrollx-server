const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_WITH_SECONDS_REGEX = /^\d{2}:\d{2}:\d{2}$/;
const TIME_WITHOUT_SECONDS_REGEX = /^\d{2}:\d{2}$/;

const padNumber = (value) => String(value).padStart(2, '0');

const isDateLike = (value) => value && typeof value.getTime === 'function';

const formatLocalDate = (value = new Date()) => {
  if (!value) return null;
  if (typeof value === 'string' && DATE_ONLY_REGEX.test(value)) {
    return value;
  }

  const parsed = isDateLike(value) ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return `${parsed.getFullYear()}-${padNumber(parsed.getMonth() + 1)}-${padNumber(parsed.getDate())}`;
};

const formatLocalTime = (value = new Date()) => {
  if (!value) return null;

  if (typeof value === 'string') {
    if (TIME_WITH_SECONDS_REGEX.test(value)) {
      return value;
    }
    if (TIME_WITHOUT_SECONDS_REGEX.test(value)) {
      return `${value}:00`;
    }
  }

  const parsed = isDateLike(value) ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return `${padNumber(parsed.getHours())}:${padNumber(parsed.getMinutes())}:${padNumber(parsed.getSeconds())}`;
};

module.exports = {
  formatLocalDate,
  formatLocalTime,
};
