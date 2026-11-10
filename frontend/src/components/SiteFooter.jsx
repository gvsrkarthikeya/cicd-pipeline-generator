import { t } from '../lib/i18n';
import './SiteFooter.css';

export default function SiteFooter({ variant = 'marketing' }) {
  const wide = variant === 'app';

  return (
    <footer className="site-footer">
      <div className={wide ? 'container-wide' : 'container'}>
        <div className="site-footer-inner">
          <p className="site-footer-copy">
            {t('footer.copyright', { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </footer>
  );
}
