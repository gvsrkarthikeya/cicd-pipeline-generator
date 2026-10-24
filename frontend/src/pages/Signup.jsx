import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthCard from '../components/AuthCard';
import { useAuth } from '../context/useAuth';
import { t } from '../lib/i18n';

export default function Signup() {
  const { signup, loading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('auth.signup.passwordMismatch'));
      return;
    }

    try {
      await signup({ name, email, password });
      navigate('/dashboard');
    } catch (err) {
      setError(err?.response?.data?.error ?? t('auth.signup.error'));
    }
  }

  return (
    <AuthCard activeTab="signup">
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <p className="form-error">{error}</p>}

        <div className="field">
          <label className="field-label" htmlFor="name">
            {t('auth.fullNameLabel')}
          </label>
          <input
            id="name"
            className="field-input"
            type="text"
            autoComplete="name"
            placeholder={t('auth.fullNamePlaceholder')}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="email">
            {t('auth.emailLabel')}
          </label>
          <input
            id="email"
            className="field-input"
            type="email"
            autoComplete="email"
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="password">
            {t('auth.passwordLabel')}
          </label>
          <input
            id="password"
            className="field-input"
            type="password"
            autoComplete="new-password"
            placeholder={t('auth.passwordPlaceholder')}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="confirmPassword">
            {t('auth.confirmPasswordLabel')}
          </label>
          <input
            id="confirmPassword"
            className="field-input"
            type="password"
            autoComplete="new-password"
            placeholder={t('auth.passwordPlaceholder')}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-block auth-submit"
          disabled={loading}
        >
          {loading ? t('auth.signup.submitting') : t('auth.signup.submit')}
        </button>
      </form>

      <p className="auth-switch">
        {t('auth.signup.switchPrompt')} <Link to="/login">{t('common.logIn')}</Link>
      </p>
    </AuthCard>
  );
}
