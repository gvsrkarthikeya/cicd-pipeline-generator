import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../lib/api.js', () => ({
  default: { get: vi.fn(), put: vi.fn() },
}));

const updateUser = vi.fn();
vi.mock('../../context/useAuth.js', () => ({
  useAuth: () => ({ user: { name: 'Jane Doe', email: 'jane@example.com' }, updateUser }),
}));

const api = (await import('../../lib/api.js')).default;
const { default: Account } = await import('../Account.jsx');

function renderAccount() {
  return render(
    <MemoryRouter>
      <Account />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: { user: { name: 'Jane Doe', email: 'jane@example.com' } } });
});

describe('Account', () => {
  it('renders the current user profile details', async () => {
    renderAccount();
    expect(await screen.findByDisplayValue('Jane Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('jane@example.com')).toBeInTheDocument();
  });

  it('updates the profile name on submit', async () => {
    api.put.mockResolvedValue({ data: { user: { name: 'Jane Smith' } } });
    renderAccount();
    await screen.findByDisplayValue('Jane Doe');

    const user = userEvent.setup();
    const nameInput = screen.getByLabelText('Full Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Jane Smith');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Profile updated.')).toBeInTheDocument();
    expect(api.put).toHaveBeenCalledWith('/auth/profile', { name: 'Jane Smith' });
    expect(updateUser).toHaveBeenCalledWith({ name: 'Jane Smith' });
  });

  it('shows a mismatch error when new passwords do not match', async () => {
    renderAccount();
    await screen.findByDisplayValue('Jane Doe');

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Current Password'), 'oldpass123');
    await user.type(screen.getByLabelText('New Password'), 'newpass123');
    await user.type(screen.getByLabelText('Confirm New Password'), 'different123');
    await user.click(screen.getByRole('button', { name: 'Change Password' }));

    expect(await screen.findByText('New passwords do not match.')).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalledWith('/auth/password', expect.anything());
  });

  it('changes the password on success', async () => {
    api.put.mockResolvedValue({});
    renderAccount();
    await screen.findByDisplayValue('Jane Doe');

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Current Password'), 'oldpass123');
    await user.type(screen.getByLabelText('New Password'), 'newpass123');
    await user.type(screen.getByLabelText('Confirm New Password'), 'newpass123');
    await user.click(screen.getByRole('button', { name: 'Change Password' }));

    expect(await screen.findByText('Password changed successfully.')).toBeInTheDocument();
    expect(api.put).toHaveBeenCalledWith('/auth/password', {
      currentPassword: 'oldpass123',
      newPassword: 'newpass123',
    });
  });
});
