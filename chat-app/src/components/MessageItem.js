import classNames from 'classnames';
import { formatTimestamp } from '../utils/format';

export default function MessageItem({ message, isOwn }) {
  const { nickname, message: text, timestamp, pending, error } = message;
  const timeLabel = formatTimestamp(timestamp);

  return (
    <li
      className={classNames('message-item', {
        'message-item--self': isOwn,
        'message-item--other': !isOwn,
        'message-item--pending': pending,
        'message-item--error': error,
      })}
      aria-live="polite"
    >
      <div
        className={classNames('message-bubble', {
          'message-bubble--self': isOwn,
          'message-bubble--other': !isOwn,
        })}
      >
        <div className="message-meta">
          <span className="message-sender">{nickname}</span>
          {timeLabel && <span className="message-time">{timeLabel}</span>}
        </div>
        <p className="message-content">{text}</p>
        {pending && <span className="message-status">전송 중…</span>}
        {error && <span className="message-status message-status--error">전송 실패</span>}
      </div>
    </li>
  );
}

