import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import AddRepoModal from '../components/AddRepoModal';
import { ClockIcon, CodeIcon, PlusIcon, SearchIcon, TrashIcon, XIcon } from '../components/icons';
import api from '../lib/api';
import { t } from '../lib/i18n';
import { relativeTime, repoDisplayName, repoStackSummary } from '../lib/repoFormat';
import './Dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [rerunningId, setRerunningId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [search, setSearch] = useState('');
  const confirmDeleteRepo = repos.find((repo) => repo.id === confirmDeleteId) ?? null;
  const filteredRepos = repos.filter((repo) =>
    repoDisplayName(repo.repo_url).toLowerCase().includes(search.trim().toLowerCase())
  );

  const loadRepos = useCallback(async () => {
    try {
      const { data } = await api.get('/repos');
      setRepos(data.repos ?? []);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.error ?? t('dashboard.loadError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    api
      .get('/repos')
      .then(({ data }) => {
        if (!cancelled) setRepos(data.repos ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.error ?? t('dashboard.loadError'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAddRepo(payload) {
    await api.post('/repos', payload);
    await loadRepos();
  }

  async function handleRerun(repoId) {
    setRerunningId(repoId);
    setError('');
    try {
      await api.post('/pipeline/generate', { repoId });
      await loadRepos();
    } catch (err) {
      setError(err?.response?.data?.error ?? t('dashboard.rerunError'));
    } finally {
      setRerunningId(null);
    }
  }

  async function handleDelete(repoId) {
    setDeletingId(repoId);
    setError('');
    try {
      await api.delete(`/repos/${repoId}`);
      setConfirmDeleteId(null);
      await loadRepos();
    } catch (err) {
      setError(err?.response?.data?.error ?? t('dashboard.deleteError'));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <SiteHeader variant="app" />

      <main className="dashboard">
        <div className="container-wide">
          <div className="dashboard-head">
            <div>
              <h1 className="dashboard-title">{t('dashboard.title')}</h1>
              <p className="dashboard-subtitle">{t('dashboard.subtitle')}</p>
            </div>
            <button
              type="button"
              className="btn btn-primary dashboard-cta"
              onClick={() => setModalOpen(true)}
            >
              <PlusIcon />
              {t('common.analyzeRepo')}
            </button>
          </div>

          {error && <p className="form-error dashboard-error">{error}</p>}

          {loading ? (
            <span
              className="skeleton dashboard-search-skeleton"
              aria-hidden="true"
            />
          ) : (
            repos.length > 0 && (
              <div className="dashboard-search">
                <SearchIcon size={16} />
                <input
                  type="search"
                  className="dashboard-search-input"
                  placeholder={t('dashboard.searchPlaceholder')}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label={t('dashboard.searchPlaceholder')}
                />
              </div>
            )
          )}

          {loading ? (
            <div className="repo-grid">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="card repo-card repo-card-skeleton" aria-hidden="true">
                  <div className="repo-card-head">
                    <span className="skeleton skeleton-text skeleton-title" />
                    <span className="skeleton skeleton-badge" />
                  </div>
                  <div className="repo-meta">
                    <span className="skeleton skeleton-text skeleton-line" />
                    <span className="skeleton skeleton-text skeleton-line" />
                  </div>
                  <div className="repo-card-actions">
                    <span className="skeleton skeleton-btn" />
                    <span className="skeleton skeleton-btn" />
                    <span className="skeleton skeleton-btn skeleton-btn-icon" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredRepos.length === 0 ? (
            <p className="dashboard-state">{t('dashboard.searchEmpty')}</p>
          ) : (
            <div className="repo-grid">
              {filteredRepos.map((repo) => (
                <article key={repo.id} className="card repo-card">
                  <div className="repo-card-head">
                    <h2 className="repo-card-name">{repoDisplayName(repo.repo_url)}</h2>
                    <span className="repo-badge">
                      {repo.is_private
                        ? t('dashboard.visibilityPrivate')
                        : t('dashboard.visibilityPublic')}
                    </span>
                  </div>

                  <ul className="repo-meta">
                    <li>
                      <CodeIcon />
                      <span>{repoStackSummary(repo.detected_stack)}</span>
                    </li>
                    <li>
                      <ClockIcon />
                      <span>
                        {t('dashboard.lastAnalyzed', {
                          time: relativeTime(repo.last_analyzed_at),
                        })}
                      </span>
                    </li>
                  </ul>

                  <div className="repo-card-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => navigate(`/repos/${repo.id}`)}
                    >
                      {t('common.view')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-muted"
                      onClick={() => handleRerun(repo.id)}
                      disabled={rerunningId === repo.id}
                    >
                      {rerunningId === repo.id ? t('common.rerunning') : t('common.rerun')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger repo-card-delete"
                      onClick={() => setConfirmDeleteId(repo.id)}
                      disabled={deletingId === repo.id}
                      aria-label={t('common.delete')}
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>
                </article>
              ))}

              <button
                type="button"
                className="repo-add-card"
                onClick={() => setModalOpen(true)}
              >
                <span className="repo-add-icon">
                  <PlusIcon size={18} />
                </span>
                <span className="repo-add-label">{t('dashboard.addRepository')}</span>
              </button>
            </div>
          )}
        </div>
      </main>

      <SiteFooter variant="app" />

      {modalOpen && (
        <AddRepoModal onClose={() => setModalOpen(false)} onAdded={handleAddRepo} />
      )}

      {confirmDeleteRepo && (
        <div
          className="modal-backdrop"
          onClick={() => setConfirmDeleteId(null)}
          role="presentation"
        >
          <div
            className="card modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-repo-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <h2 id="delete-repo-title" className="modal-title">
                {t('dashboard.deleteTitle', { name: repoDisplayName(confirmDeleteRepo.repo_url) })}
              </h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setConfirmDeleteId(null)}
                aria-label={t('common.cancel')}
              >
                <XIcon size={16} />
              </button>
            </div>

            <p className="modal-subtitle">{t('dashboard.deleteConfirm')}</p>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-muted"
                onClick={() => setConfirmDeleteId(null)}
                disabled={deletingId === confirmDeleteRepo.id}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => handleDelete(confirmDeleteRepo.id)}
                disabled={deletingId === confirmDeleteRepo.id}
              >
                {deletingId === confirmDeleteRepo.id ? t('common.deleting') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
