import { LogoMarkIcon } from './icons';
import { t } from '../lib/i18n';
import './Logo.css';

export default function Logo({ size = 'md' }) {
  const px = size === 'lg' ? 28 : size === 'sm' ? 20 : 24;

  return (
    <span className={`logo logo-${size}`}>
      <span className="logo-mark">
        <LogoMarkIcon size={px} />
      </span>
      <span className="logo-word">{t('app.name')}</span>
    </span>
  );
}
