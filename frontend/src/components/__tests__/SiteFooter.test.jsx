import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SiteFooter from '../SiteFooter.jsx';

describe('<SiteFooter />', () => {
  it('renders the copyright line with the current year interpolated', () => {
    render(<SiteFooter />);
    const year = new Date().getFullYear();
    expect(screen.getByText(`© ${year} PipelineKit Inc. All rights reserved.`)).toBeInTheDocument();
  });

  it('renders privacy and terms links', () => {
    render(<SiteFooter />);
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
    expect(screen.getByText('Terms of Service')).toBeInTheDocument();
  });
});
