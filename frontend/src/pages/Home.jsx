import { useState } from 'react';
import { Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import { CheckIcon, CubeIcon } from '../components/icons';
import { t } from '../lib/i18n';
import './Home.css';

export default function Home() {
  const previewTabs = t('home.preview.tabs');
  const [activeTab, setActiveTab] = useState(0);
  const activePreview = previewTabs[activeTab];

  return (
    <>
      <SiteHeader />

      <main>
        <section className="hero">
          <div className="container">
            <h1 className="hero-title">
              {t('home.hero.titleLine1')}
              <br />
              {t('home.hero.titleLine2')}
            </h1>
            <p className="hero-subtitle">{t('home.hero.subtitle')}</p>
            <div className="hero-actions">
              <Link to="/signup" className="btn btn-primary">
                {t('home.hero.getStarted')}
              </Link>
              <a href="#how-it-works" className="btn btn-secondary">
                {t('home.hero.howItWorks')}
              </a>
            </div>
          </div>
        </section>

        <section className="section section-subtle">
          <div className="container">
            <p className="eyebrow section-eyebrow">{t('home.preview.eyebrow')}</p>
            <div className="card preview-card">
              <div className="preview-tabs" role="tablist">
                {previewTabs.map((tab, index) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={index === activeTab}
                    className={
                      'preview-tab' + (index === activeTab ? ' preview-tab-active' : '')
                    }
                    onClick={() => setActiveTab(index)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="preview-grid">
                <div className="preview-code">
                  <div className="preview-code-head">
                    <span className="preview-code-title">{activePreview.title}</span>
                    <span className="preview-code-file">{activePreview.fileName}</span>
                  </div>
                  <pre className="preview-code-body">{activePreview.sampleYaml}</pre>
                </div>

                <div className="preview-reasons">
                  <h3 className="preview-reasons-title">
                    {t('home.preview.reasonsTitle')}
                  </h3>
                  <ul className="preview-reasons-list">
                    {activePreview.reasons.map((reason) => (
                      <li key={reason}>
                        <CheckIcon />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section section-stacks">
          <div className="container">
            <p className="eyebrow section-eyebrow">{t('home.stacks.eyebrow')}</p>
            <ul className="stack-pills">
              {t('home.stacks.items').map((stack) => (
                <li key={stack} className="stack-pill">
                  {stack}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section" id="how-it-works">
          <div className="container">
            <h2 className="section-title">{t('home.steps.title')}</h2>
            <p className="section-subtitle">{t('home.steps.subtitle')}</p>
            <div className="steps-grid">
              {t('home.steps.items').map((step) => (
                <article key={step.number} className="card step-card">
                  <span className="step-number">{step.number}</span>
                  <h3 className="step-title">{step.title}</h3>
                  <p className="step-body">{step.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section section-subtle section-features">
          <div className="container">
            <h2 className="features-title">{t('home.features.title')}</h2>
            <p className="features-subtitle">{t('home.features.subtitle')}</p>
            <div className="features-grid">
              {t('home.features.items').map((feature) => (
                <article key={feature.title} className="card feature-card">
                  <span className="feature-icon">
                    <CubeIcon size={20} />
                  </span>
                  <h3 className="feature-title">{feature.title}</h3>
                  <p className="feature-body">{feature.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
