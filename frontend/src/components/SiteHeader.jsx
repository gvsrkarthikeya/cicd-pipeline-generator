import { Link } from 'react-router-dom';
import Logo from './Logo';
import { useAuth } from '../context/useAuth';
import { t } from '../lib/i18n';
import './SiteHeader.css';

function initials(name = '') {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? '')
      .join('')
      .toUpperCase() || 'U'
  );
}

export default function SiteHeader({ variant = 'marketing' }) {
  const { user, isAuthenticated, logout } = useAuth();
  const wide = variant === 'app';

  return (
    <header className={`site-header ${wide ? 'site-header-app' : ''}`}>
      <div className={wide ? 'container-wide' : 'container'}>
        <div className="site-header-inner">
          <Link to={isAuthenticated ? '/dashboard' : '/'} aria-label={t('app.homeAriaLabel')}>
            <Logo size={wide ? 'lg' : 'md'} />
          </Link>

          <nav className="site-header-nav">
            {isAuthenticated ? (
              <>
                <button type="button" className="site-header-link" onClick={logout}>
                  {t('common.logOut')}
                </button>
                <Link
                  to="/account"
                  className="site-header-avatar"
                  title={user?.name ?? t('common.account')}
                >
                  {initials(user?.name)}
                </Link>
              </>
            ) : (
              <Link to="/login" className="site-header-link">
                {t('common.logIn')}
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
