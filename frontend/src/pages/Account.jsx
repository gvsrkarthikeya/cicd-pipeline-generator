import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import api from '../lib/api';
import { t } from '../lib/i18n';
import { useAuth } from '../context/useAuth';
import './Account.css';

export default function Account() {
  const { user, updateUser } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);

  useEffect(() => {
    api
      .get('/auth/me')
      .then(({ data }) => {
        setName(data.user.name);
        updateUser({ name: data.user.name, email: data.user.email });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setProfileError('');
    setProfileSaved(false);
    setProfileSaving(true);
    try {
      const { data } = await api.put('/auth/profile', { name });
      updateUser({ name: data.user.name });
      setProfileSaved(true);
    } catch (err) {
      setProfileError(err?.response?.data?.error ?? t('account.profileError'));
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setPasswordError('');
    setPasswordSaved(false);

    if (newPassword !== confirmPassword) {
      setPasswordError(t('account.passwordMismatch'));
      return;
    }

    setPasswordSaving(true);
    try {
      await api.put('/auth/password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSaved(true);
    } catch (err) {
      setPasswordError(err?.response?.data?.error ?? t('account.passwordError'));
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <>
      <SiteHeader variant="app" />

      <main className="account">
        <div className="container-wide">
          <nav className="repo-detail-breadcrumb">
            <Link to="/dashboard">{t('repoDetail.back')}</Link>
            <span>/</span>
            <span>{t('account.title')}</span>
          </nav>

          <h1 className="account-title">{t('account.title')}</h1>
          <p className="account-subtitle">{t('account.subtitle')}</p>

          <div className="account-grid">
            <section className="card account-card">
              <h2 className="overview-card-title">{t('account.profileTitle')}</h2>
              {profileError && <p className="form-error">{profileError}</p>}
              {profileSaved && <p className="form-success">{t('account.profileSaved')}</p>}
              <form className="auth-form" onSubmit={handleProfileSubmit}>
                <div className="field">
                  <label className="field-label" htmlFor="name">
                    {t('account.nameLabel')}
                  </label>
                  <input
                    id="name"
                    className="field-input"
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="email">
                    {t('auth.emailLabel')}
                  </label>
                  <input id="email" className="field-input" type="email" value={user?.email ?? ''} disabled />
                </div>
                <button type="submit" className="btn btn-primary" disabled={profileSaving}>
                  {profileSaving ? t('account.saving') : t('common.save')}
                </button>
              </form>
            </section>

            <section className="card account-card">
              <h2 className="overview-card-title">{t('account.passwordTitle')}</h2>
              {passwordError && <p className="form-error">{passwordError}</p>}
              {passwordSaved && <p className="form-success">{t('account.passwordSaved')}</p>}
              <form className="auth-form" onSubmit={handlePasswordSubmit}>
                <div className="field">
                  <label className="field-label" htmlFor="currentPassword">
                    {t('account.currentPasswordLabel')}
                  </label>
                  <input
                    id="currentPassword"
                    className="field-input"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="newPassword">
                    {t('account.newPasswordLabel')}
                  </label>
                  <input
                    id="newPassword"
                    className="field-input"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    minLength={8}
                    required
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="confirmNewPassword">
                    {t('account.confirmNewPasswordLabel')}
                  </label>
                  <input
                    id="confirmNewPassword"
                    className="field-input"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    minLength={8}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={passwordSaving}>
                  {passwordSaving ? t('account.saving') : t('account.changePassword')}
                </button>
              </form>
            </section>
          </div>
        </div>
      </main>

      <SiteFooter variant="app" />
    </>
  );
}
