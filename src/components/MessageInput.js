import classNames from 'classnames';
import { useEffect, useRef, useState } from 'react';
import { MAX_MESSAGE_LENGTH, validText } from '../utils/validators';

const MAX_ROWS = 4;

export default function MessageInput({ disabled, onSend }) {
  const [value, setValue] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef(null);

  const remaining = MAX_MESSAGE_LENGTH - value.length;

  useEffect(() => {
    adjustTextareaHeight();
  }, [value]);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = 'auto';
    const computedStyle =
      typeof window !== 'undefined' ? window.getComputedStyle(textarea) : null;
    const lineHeight = parseInt((computedStyle && computedStyle.lineHeight) || '20', 10);
    const maxHeight = lineHeight * MAX_ROWS;
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  };

  const handleChange = (event) => {
    const nextValue = event.target.value.slice(0, MAX_MESSAGE_LENGTH);
    setValue(nextValue);
  };

  const resetInput = () => {
    setValue('');
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = '';
    }
  };

  const attemptSend = () => {
    if (disabled) {
      return;
    }
    if (!validText(value)) {
      return;
    }
    if (typeof onSend === 'function') {
      const result = onSend(value.trim());
      if (result === false) {
        return;
      }
    }
    resetInput();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
      event.preventDefault();
      attemptSend();
    }
  };

  const isSendDisabled = disabled || !validText(value);

  return (
    <div className="message-input">
      <label className="sr-only" htmlFor="chat-input">
        메시지 입력
      </label>
      <textarea
        id="chat-input"
        ref={textareaRef}
        className="message-input-textarea"
        placeholder="메시지를 입력하세요. Enter: 전송 / Shift+Enter: 줄바꿈"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        disabled={disabled}
        aria-label="메시지 입력"
        maxLength={MAX_MESSAGE_LENGTH}
        rows={1}
      />
      <div className="message-input-footer">
        <span
          className={classNames('message-input-counter', {
            'message-input-counter--warning': remaining <= 50,
            'message-input-counter--danger': remaining <= 10,
          })}
          aria-live="polite"
        >
          {remaining}
        </span>
        <button
          type="button"
          className="message-send-button"
          onClick={attemptSend}
          disabled={isSendDisabled}
        >
          전송
        </button>
      </div>
    </div>
  );
}

