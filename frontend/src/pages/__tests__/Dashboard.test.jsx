import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../lib/api.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

vi.mock('../../context/useAuth.js', () => ({
  useAuth: () => ({ user: { name: 'Jane Doe', email: 'jane@example.com' }, updateUser: vi.fn(), logout: vi.fn() }),
}));

const api = (await import('../../lib/api.js')).default;
const { default: Dashboard } = await import('../Dashboard.jsx');

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Dashboard', () => {
  it('shows an error message when loading repos fails', async () => {
    api.get.mockRejectedValue({ response: { data: { error: 'Boom' } } });
    renderDashboard();
    expect(await screen.findByText('Boom')).toBeInTheDocument();
  });

  it('renders the repo list once loaded', async () => {
    api.get.mockResolvedValue({
      data: {
        repos: [
          {
            id: 'r1',
            repo_url: 'https://github.com/acme/widgets',
            is_private: false,
            detected_stack: { success: true, analysis: { language: 'nodejs' } },
            last_analyzed_at: new Date().toISOString(),
          },
        ],
      },
    });
    renderDashboard();
    expect(await screen.findByText('acme/widgets')).toBeInTheDocument();
    expect(screen.getByText('Public')).toBeInTheDocument();
  });

  it('shows the empty search state when no repo matches the filter', async () => {
    api.get.mockResolvedValue({
      data: {
        repos: [
          {
            id: 'r1',
            repo_url: 'https://github.com/acme/widgets',
            is_private: false,
            detected_stack: null,
            last_analyzed_at: null,
          },
        ],
      },
    });
    renderDashboard();
    await screen.findByText('acme/widgets');

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Search repositories…'), 'nonexistent');

    expect(screen.getByText('No repositories match your search.')).toBeInTheDocument();
  });

  it('opens the add-repository modal', async () => {
    api.get.mockResolvedValue({ data: { repos: [] } });
    renderDashboard();
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.click(screen.getByText('Analyze Repo'));

    expect(screen.getByText('Add Repository', { selector: 'h2' })).toBeInTheDocument();
  });

  it('deletes a repo after confirming', async () => {
    api.get.mockResolvedValue({
      data: {
        repos: [
          {
            id: 'r1',
            repo_url: 'https://github.com/acme/widgets',
            is_private: false,
            detected_stack: null,
            last_analyzed_at: null,
          },
        ],
      },
    });
    api.delete.mockResolvedValue({});
    renderDashboard();
    await screen.findByText('acme/widgets');

    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Delete'));
    expect(screen.getByText(/Delete acme\/widgets\?/)).toBeInTheDocument();

    api.get.mockResolvedValueOnce({ data: { repos: [] } });
    const modal = screen.getByRole('dialog');
    await user.click(within(modal).getByText('Delete'));

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/repos/r1'));
  });
});
