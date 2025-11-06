import { render, screen } from '@testing-library/react';
import App from './App';

test('renders nickname modal on initial load', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: '닉네임을 입력해주세요' })).toBeInTheDocument();
});
