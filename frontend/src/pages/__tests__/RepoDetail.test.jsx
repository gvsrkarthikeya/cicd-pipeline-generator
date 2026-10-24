import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../../lib/api.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

vi.mock('../../context/useAuth.js', () => ({
  useAuth: () => ({ user: { name: 'Jane Doe', email: 'jane@example.com' }, updateUser: vi.fn(), logout: vi.fn() }),
}));

const api = (await import('../../lib/api.js')).default;
const { default: RepoDetail } = await import('../RepoDetail.jsx');

function renderRepoDetail(repoId = 'r1') {
  return render(
    <MemoryRouter initialEntries={[`/repos/${repoId}`]}>
      <Routes>
        <Route path="/repos/:repoId" element={<RepoDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RepoDetail', () => {
  it('shows the load error state when the repo cannot be found', async () => {
    api.get.mockRejectedValue({ response: { data: { error: 'Not found' } } });
    renderRepoDetail();
    expect(await screen.findByText('Not found')).toBeInTheDocument();
  });

  it('renders the overview tab once the repo and pipeline load', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/repos/r1') {
        return Promise.resolve({
          data: {
            repo: {
              id: 'r1',
              repo_url: 'https://github.com/acme/widgets',
              branch: 'main',
              detected_stack: { success: true, analysis: { language: 'nodejs', dependencies: [] } },
              last_analyzed_at: new Date().toISOString(),
            },
          },
        });
      }
      if (url === '/pipeline/r1') {
        return Promise.resolve({ data: { pipeline: { id: 'p1', yaml_content: 'name: x', reasoning: [] } } });
      }
      return Promise.reject(new Error('unexpected url ' + url));
    });

    renderRepoDetail();

    expect((await screen.findAllByText('acme/widgets')).length).toBeGreaterThan(0);
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
  });

  it('switches to the history tab and loads history lazily', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/repos/r1') {
        return Promise.resolve({
          data: {
            repo: {
              id: 'r1',
              repo_url: 'https://github.com/acme/widgets',
              branch: 'main',
              detected_stack: null,
              last_analyzed_at: null,
            },
          },
        });
      }
      if (url === '/pipeline/r1') {
        return Promise.resolve({ data: { pipeline: null } });
      }
      if (url === '/history/r1') {
        return Promise.resolve({ data: { history: [] } });
      }
      return Promise.reject(new Error('unexpected url ' + url));
    });

    renderRepoDetail();
    await screen.findAllByText('acme/widgets');

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'History' }));

    expect(await screen.findByText('No changes have been made to this pipeline yet.')).toBeInTheDocument();
  });
});
