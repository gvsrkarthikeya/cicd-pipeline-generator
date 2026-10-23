import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthCard from '../components/AuthCard';
import { useAuth } from '../context/useAuth';
import { t } from '../lib/i18n';

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    try {
      await login({ email, password });
      navigate('/dashboard');
    } catch (err) {
      setError(err?.response?.data?.error ?? t('auth.login.error'));
    }
  }

  return (
    <AuthCard activeTab="login">
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <p className="form-error">{error}</p>}

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
          <div className="auth-label-row">
            <label className="field-label" htmlFor="password">
              {t('auth.passwordLabel')}
            </label>
            <Link className="auth-link-small" to="/forgot-password">
              {t('auth.forgotPassword')}
            </Link>
          </div>
          <input
            id="password"
            className="field-input"
            type="password"
            autoComplete="current-password"
            placeholder={t('auth.passwordPlaceholder')}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-block auth-submit"
          disabled={loading}
        >
          {loading ? t('auth.login.submitting') : t('auth.login.submit')}
        </button>
      </form>

      <p className="auth-switch">
        {t('auth.login.switchPrompt')} <Link to="/signup">{t('common.signUp')}</Link>
      </p>
    </AuthCard>
  );
}
