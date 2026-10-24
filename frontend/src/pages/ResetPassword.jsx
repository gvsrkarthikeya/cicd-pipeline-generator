import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthCard from '../components/AuthCard';
import api from '../lib/api';
import { t } from '../lib/i18n';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('auth.resetPasswordPage.mismatch'));
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err?.response?.data?.error ?? t('auth.resetPasswordPage.error'));
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthCard>
        <p className="form-error">{t('auth.resetPasswordPage.missingToken')}</p>
        <p className="auth-switch">
          <Link to="/forgot-password">{t('auth.forgotPasswordPage.backToLogin')}</Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      {done ? (
        <p className="form-success">{t('auth.resetPasswordPage.success')}</p>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <p className="form-error">{error}</p>}
          <p className="auth-card-tagline">{t('auth.resetPasswordPage.subtitle')}</p>

          <div className="field">
            <label className="field-label" htmlFor="password">
              {t('auth.resetPasswordPage.newPasswordLabel')}
            </label>
            <input
              id="password"
              className="field-input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="confirmPassword">
              {t('auth.resetPasswordPage.confirmPasswordLabel')}
            </label>
            <input
              id="confirmPassword"
              className="field-input"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={submitting}>
            {submitting ? t('auth.resetPasswordPage.submitting') : t('auth.resetPasswordPage.submit')}
          </button>
        </form>
      )}

      <p className="auth-switch">
        <Link to="/login">{t('auth.forgotPasswordPage.backToLogin')}</Link>
      </p>
    </AuthCard>
  );
}
