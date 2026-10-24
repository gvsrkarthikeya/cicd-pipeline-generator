import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthCard from '../components/AuthCard';
import api from '../lib/api';
import { t } from '../lib/i18n';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [resetLink, setResetLink] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
      if (data.resetToken) {
        setResetLink(`${window.location.origin}/reset-password?token=${data.resetToken}`);
      }
    } catch (err) {
      setError(err?.response?.data?.error ?? t('auth.forgotPasswordPage.error'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard>
      {submitted ? (
        <div className="auth-form">
          <p className="form-success">{t('auth.forgotPasswordPage.sent')}</p>
          {resetLink && (
            <div className="field">
              <label className="field-label">{t('auth.forgotPasswordPage.devLinkLabel')}</label>
              <input className="field-input" type="text" readOnly value={resetLink} onFocus={(e) => e.target.select()} />
              <p className="auth-note">{t('auth.forgotPasswordPage.devLinkNote')}</p>
            </div>
          )}
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <p className="form-error">{error}</p>}
          <p className="auth-card-tagline">{t('auth.forgotPasswordPage.subtitle')}</p>

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

          <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={submitting}>
            {submitting ? t('auth.forgotPasswordPage.submitting') : t('auth.forgotPasswordPage.submit')}
          </button>
        </form>
      )}

      <p className="auth-switch">
        <Link to="/login">{t('auth.forgotPasswordPage.backToLogin')}</Link>
      </p>
    </AuthCard>
  );
}
