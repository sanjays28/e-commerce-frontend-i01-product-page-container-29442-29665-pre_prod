import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Product Page Component heading', () => {
  render(<App />);
  const headingElement = screen.getByText(/Product Page Component/i);
  expect(headingElement).toBeInTheDocument();
});
