import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SiteFooter from '../SiteFooter.jsx';

describe('<SiteFooter />', () => {
  it('renders the copyright line with the current year interpolated', () => {
    render(<SiteFooter />);
    const year = new Date().getFullYear();
    expect(screen.getByText(`© ${year} PipelineKit Inc. All rights reserved.`)).toBeInTheDocument();
  });

  it('does not render privacy or terms links', () => {
    render(<SiteFooter />);
    expect(screen.queryByText('Privacy Policy')).not.toBeInTheDocument();
    expect(screen.queryByText('Terms of Service')).not.toBeInTheDocument();
  });
});
