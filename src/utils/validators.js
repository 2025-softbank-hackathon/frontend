export const MAX_MESSAGE_LENGTH = 500;

export const validText = (value = '') => {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return false;
  }
  return trimmed.length <= MAX_MESSAGE_LENGTH;
};

