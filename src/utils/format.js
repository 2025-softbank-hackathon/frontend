import dayjs from 'dayjs';

export const formatTimestamp = (timestamp) => {
  if (!timestamp) {
    return '';
  }
  return dayjs(timestamp).format('HH:mm');
};

