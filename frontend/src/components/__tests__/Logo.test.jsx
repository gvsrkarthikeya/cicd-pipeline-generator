import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Logo from '../Logo.jsx';

describe('<Logo />', () => {
  it('renders the app name', () => {
    render(<Logo />);
    expect(screen.getByText('PipelineKit')).toBeInTheDocument();
  });

  it('applies the size-specific class', () => {
    const { container } = render(<Logo size="lg" />);
    expect(container.querySelector('.logo-lg')).toBeInTheDocument();
  });
});
