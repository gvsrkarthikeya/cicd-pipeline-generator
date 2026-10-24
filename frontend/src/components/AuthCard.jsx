import { Link } from 'react-router-dom';
import Logo from './Logo';
import { t } from '../lib/i18n';
import './AuthCard.css';

export default function AuthCard({ activeTab, children }) {
  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="auth-card-head">
          <Logo size="lg" />
          <p className="auth-card-tagline">{t('auth.tagline')}</p>
        </div>

        {(activeTab === 'login' || activeTab === 'signup') && (
          <div className="auth-tabs" role="tablist">
            <Link
              to="/login"
              role="tab"
              aria-selected={activeTab === 'login'}
              className={`auth-tab ${activeTab === 'login' ? 'auth-tab-active' : ''}`}
            >
              {t('common.logIn')}
            </Link>
            <Link
              to="/signup"
              role="tab"
              aria-selected={activeTab === 'signup'}
              className={`auth-tab ${activeTab === 'signup' ? 'auth-tab-active' : ''}`}
            >
              {t('common.signUp')}
            </Link>
          </div>
        )}

        {children}

        <p className="auth-note">{t('auth.githubNote')}</p>
      </div>
    </div>
  );
}
