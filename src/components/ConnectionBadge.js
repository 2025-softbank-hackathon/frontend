import classNames from 'classnames';
import { CONNECTION_STATUS } from '../hooks/useChat';

const STATUS_LABELS = {
  [CONNECTION_STATUS.CONNECTED]: '연결됨',
  [CONNECTION_STATUS.CONNECTING]: '연결 중…',
  [CONNECTION_STATUS.RECONNECTING]: '재연결 중…',
  [CONNECTION_STATUS.DISCONNECTED]: '연결 안 됨',
};

export default function ConnectionBadge({ status, message }) {
  const label = STATUS_LABELS[status] || STATUS_LABELS[CONNECTION_STATUS.DISCONNECTED];
  const content = message || label;

  return (
    <span
      className={classNames('connection-badge', `connection-badge--${status}`)}
      role="status"
      aria-live="polite"
    >
      {content}
    </span>
  );
}

