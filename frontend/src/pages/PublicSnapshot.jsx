import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import api from '../lib/api';
import { t } from '../lib/i18n';
import { relativeTime, repoDisplayName } from '../lib/repoFormat';
import './RepoDetail.css';
import './PublicSnapshot.css';

const HISTORY_BADGE_KEY = {
  ADD: 'added',
  EDIT: 'edited',
  DELETE: 'deleted',
};

export default function PublicSnapshot() {
  const { shareId } = useParams();
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    api
      .get(`/public/pipeline/${shareId}`)
      .then(({ data }) => {
        if (!cancelled) setSnapshot(data.snapshot);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.error ?? t('publicSnapshot.notFound'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [shareId]);

  const yamlContent = snapshot?.after_state?.yaml ?? null;
  const stateDetail = yamlContent
    ? null
    : (snapshot?.after_state ?? snapshot?.before_state ?? null);

  return (
    <>
      <SiteHeader />

      <main className="public-snapshot">
        <div className="container">
          {loading && <p className="dashboard-state">{t('publicSnapshot.loading')}</p>}

          {!loading && (error || !snapshot) && (
            <p className="form-error">{error || t('publicSnapshot.notFound')}</p>
          )}

          {!loading && snapshot && (
            <section className="repo-detail-panel">
              <h1 className="repo-detail-panel-title">{t('publicSnapshot.title')}</h1>
              {snapshot.repos?.repo_url && (
                <p className="repo-detail-panel-subtitle">
                  {repoDisplayName(snapshot.repos.repo_url)}
                </p>
              )}

              <div className="card public-snapshot-meta">
                <span className={`history-badge history-badge-${HISTORY_BADGE_KEY[snapshot.action]}`}>
                  {t(`repoDetail.history.${HISTORY_BADGE_KEY[snapshot.action]}`)}
                </span>
                <strong>{snapshot.step_name}</strong>
                <span className="history-card-time">{relativeTime(snapshot.created_at)}</span>
              </div>

              {yamlContent && (
                <div className="yaml-card">
                  <div className="yaml-card-head">
                    <span className="yaml-card-title">{t('repoDetail.pipeline.yamlTitle')}</span>
                  </div>
                  <pre className="yaml-card-body">{yamlContent}</pre>
                </div>
              )}

              {!yamlContent && stateDetail && (
                <pre className="history-yaml-preview">{JSON.stringify(stateDetail, null, 2)}</pre>
              )}
            </section>
          )}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
