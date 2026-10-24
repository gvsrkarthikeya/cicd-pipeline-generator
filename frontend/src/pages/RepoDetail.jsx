import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  CopyIcon,
  DownloadIcon,
  LightbulbIcon,
  ShareIcon,
  ShieldAlertIcon,
  UndoIcon,
} from '../components/icons';
import api from '../lib/api';
import { t } from '../lib/i18n';
import {
  extractStepKind,
  extractStepNames,
  extractStepRunCommand,
  reasoningConfidenceScores,
  reasoningTrailItems,
  relativeTime,
  repoDisplayName,
  repoStackChips,
} from '../lib/repoFormat';
import './RepoDetail.css';

const TABS = ['overview', 'pipeline', 'history', 'recommendations'];

export default function RepoDetail() {
  const { repoId } = useParams();

  const [repo, setRepo] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [history, setHistory] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [rerunning, setRerunning] = useState(false);
  const [editingBranch, setEditingBranch] = useState(false);
  const [branchInput, setBranchInput] = useState('');

  const loadRepo = useCallback(async () => {
    const { data } = await api.get(`/repos/${repoId}`);
    setRepo(data.repo);
  }, [repoId]);

  const loadPipeline = useCallback(async () => {
    try {
      const { data } = await api.get(`/pipeline/${repoId}`);
      setPipeline(data.pipeline);
    } catch {
      setPipeline(null);
    }
  }, [repoId]);

  const loadHistory = useCallback(async () => {
    const { data } = await api.get(`/history/${repoId}`);
    setHistory(data.history ?? []);
  }, [repoId]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      api.get(`/repos/${repoId}`),
      api.get(`/pipeline/${repoId}`).catch(() => ({ data: { pipeline: null } })),
    ])
      .then(([repoRes, pipelineRes]) => {
        if (cancelled) return;
        setRepo(repoRes.data.repo);
        setPipeline(pipelineRes.data.pipeline);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.error ?? t('repoDetail.loadError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [repoId]);

  useEffect(() => {
    let cancelled = false;

    if (activeTab === 'history' && history === null) {
      api.get(`/history/${repoId}`).then(({ data }) => {
        if (!cancelled) setHistory(data.history ?? []);
      });
    }
    if (activeTab === 'recommendations' && recommendations === null) {
      api
        .get(`/pipeline/${repoId}/recommendations`)
        .then(({ data }) => {
          if (!cancelled) setRecommendations(data.recommendations ?? []);
        })
        .catch(() => {
          if (!cancelled) setRecommendations([]);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [activeTab, history, recommendations, repoId]);

  async function handleRerun(branchOverride) {
    setRerunning(true);
    setError('');
    try {
      await api.post('/pipeline/generate', {
        repoId,
        ...(branchOverride ? { branch: branchOverride } : {}),
      });
      await Promise.all([loadRepo(), loadPipeline()]);
      setHistory(null);
      setRecommendations(null);
      setEditingBranch(false);
    } catch (err) {
      setError(err?.response?.data?.error ?? t('repoDetail.loadError'));
    } finally {
      setRerunning(false);
    }
  }

  function startEditBranch() {
    setBranchInput(repo.branch);
    setEditingBranch(true);
  }

  async function handleBranchSubmit(event) {
    event.preventDefault();
    const nextBranch = branchInput.trim();
    if (!nextBranch || nextBranch === repo.branch) {
      setEditingBranch(false);
      return;
    }
    await handleRerun(nextBranch);
  }

  if (loading) {
    return (
      <>
        <SiteHeader variant="app" />
        <main className="repo-detail">
          <div className="container-wide">
            <RepoDetailSkeleton />
          </div>
        </main>
        <SiteFooter variant="app" />
      </>
    );
  }

  if (!repo) {
    return (
      <>
        <SiteHeader variant="app" />
        <main className="repo-detail">
          <div className="container-wide">
            <p className="form-error">{error || t('repoDetail.loadError')}</p>
          </div>
        </main>
        <SiteFooter variant="app" />
      </>
    );
  }

  return (
    <>
      <SiteHeader variant="app" />

      <main className="repo-detail">
        <div className="container-wide">
          <nav className="repo-detail-breadcrumb">
            <Link to="/dashboard">{t('repoDetail.back')}</Link>
            <span>/</span>
            <span>{repoDisplayName(repo.repo_url)}</span>
          </nav>

          <div className="repo-detail-head">
            <div>
              <h1 className="repo-detail-title">
                {repoDisplayName(repo.repo_url)}
                {editingBranch ? (
                  <form className="repo-detail-branch-form" onSubmit={handleBranchSubmit}>
                    <input
                      className="field-input repo-detail-branch-input"
                      value={branchInput}
                      onChange={(event) => setBranchInput(event.target.value)}
                      disabled={rerunning}
                      autoFocus
                    />
                    <button type="submit" className="btn btn-primary btn-xs" disabled={rerunning}>
                      {rerunning ? t('repoDetail.rerunning') : t('common.save')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-muted btn-xs"
                      onClick={() => setEditingBranch(false)}
                      disabled={rerunning}
                    >
                      {t('common.cancel')}
                    </button>
                  </form>
                ) : (
                  <button type="button" className="repo-detail-branch" onClick={startEditBranch}>
                    {repo.branch}
                  </button>
                )}
              </h1>
              <p className="repo-detail-subtitle">
                {t('repoDetail.lastAnalyzed', { time: relativeTime(repo.last_analyzed_at) })}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleRerun()}
              disabled={rerunning}
            >
              <ClockIcon />
              {rerunning ? t('repoDetail.rerunning') : t('repoDetail.rerun')}
            </button>
          </div>

          {error && <p className="form-error dashboard-error">{error}</p>}

          <div className="repo-detail-tabs" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={tab === activeTab}
                className={
                  'repo-detail-tab' + (tab === activeTab ? ' repo-detail-tab-active' : '')
                }
                onClick={() => setActiveTab(tab)}
              >
                {t(`repoDetail.tabs.${tab}`)}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && <OverviewTab repo={repo} pipeline={pipeline} />}
          {activeTab === 'pipeline' && (
            <PipelineTab
              repoId={repoId}
              pipeline={pipeline}
              onChanged={async () => {
                await loadPipeline();
                setHistory(null);
              }}
            />
          )}
          {activeTab === 'history' && (
            <HistoryTab
              history={history}
              onChanged={async () => {
                await loadPipeline();
                await loadHistory();
              }}
            />
          )}
          {activeTab === 'recommendations' && (
            <RecommendationsTab
              repoId={repoId}
              recommendations={recommendations}
              onApplied={async () => {
                await loadPipeline();
                setHistory(null);
              }}
            />
          )}
        </div>
      </main>

      <SiteFooter variant="app" />
    </>
  );
}

function RepoDetailSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="repo-detail-breadcrumb">
        <span className="skeleton" style={{ width: 120, height: 12 }} />
      </div>
      <div className="repo-detail-head">
        <div>
          <span className="skeleton" style={{ width: 220, height: 22, marginBottom: 10 }} />
          <span className="skeleton" style={{ width: 160, height: 13 }} />
        </div>
        <span
          className="skeleton"
          style={{ width: 120, height: 38, borderRadius: 'var(--radius-sm)' }}
        />
      </div>
      <div className="repo-detail-tabs">
        {TABS.map((tab) => (
          <span
            key={tab}
            className="skeleton"
            style={{ width: 90, height: 16, marginRight: 24, marginBottom: 14 }}
          />
        ))}
      </div>
      <div className="card repo-detail-panel">
        <span className="skeleton" style={{ width: 160, height: 18, marginBottom: 10 }} />
        <span className="skeleton" style={{ width: 280, height: 13, marginBottom: 20 }} />
        <span className="skeleton" style={{ width: '100%', height: 13, marginBottom: 10 }} />
        <span className="skeleton" style={{ width: '100%', height: 13, marginBottom: 10 }} />
        <span className="skeleton" style={{ width: '70%', height: 13 }} />
      </div>
    </div>
  );
}

function OverviewTab({ repo, pipeline }) {
  const chips = repoStackChips(repo.detected_stack);
  const reasoning = pipeline?.reasoning ?? repo.detected_stack?.reasoning ?? [];
  const scores = reasoningConfidenceScores(reasoning);
  const trail = reasoningTrailItems(reasoning);

  if (!chips.length) {
    return <p className="dashboard-state">{t('repoDetail.overview.empty')}</p>;
  }

  return (
    <section className="repo-detail-panel">
      <h2 className="repo-detail-panel-title">{t('repoDetail.overview.title')}</h2>
      <p className="repo-detail-panel-subtitle">{t('repoDetail.overview.subtitle')}</p>

      <div className="overview-grid">
        <div className="card overview-card">
          <h3 className="overview-card-title">{t('repoDetail.overview.stackTitle')}</h3>
          <ul className="stack-chip-list">
            {chips.map((chip) => (
              <li key={chip} className="stack-chip">
                {chip}
              </li>
            ))}
          </ul>
        </div>

        {scores.length > 0 && (
          <div className="card overview-card">
            <h3 className="overview-card-title">{t('repoDetail.overview.confidenceTitle')}</h3>
            <ul className="confidence-list">
              {scores.map((score) => (
                <li key={score.label} className="confidence-item">
                  <div className="confidence-item-head">
                    <span>{score.label}</span>
                    <span>{score.value}%</span>
                  </div>
                  <div className="confidence-bar">
                    <div className="confidence-bar-fill" style={{ width: `${score.value}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {trail.length > 0 && (
        <div className="card overview-reasoning">
          <h3 className="overview-card-title">{t('repoDetail.overview.reasoningTitle')}</h3>
          <ul className="reasoning-list">
            {trail.map((item) => (
              <li key={item}>
                <CheckIcon />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function PipelineTab({ repoId, pipeline, onChanged }) {
  const [stepName, setStepName] = useState('');
  const [command, setCommand] = useState('');
  const [positionOverride, setPositionOverride] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);
  const [editingStep, setEditingStep] = useState(null);
  const [deletingStep, setDeletingStep] = useState(null);

  const steps = pipeline ? extractStepNames(pipeline.yaml_content) : [];
  const position = positionOverride || steps[steps.length - 1] || '';
  const editableSteps = pipeline
    ? steps.filter((name) => extractStepKind(pipeline.yaml_content, name) === 'run')
    : [];

  if (!pipeline) {
    return <p className="dashboard-state">{t('repoDetail.pipeline.empty')}</p>;
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(pipeline.yaml_content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleDownload() {
    const blob = new Blob([pipeline.yaml_content], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'github-actions.yml';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleShare() {
    setSharing(true);
    setError('');
    try {
      const { data } = await api.get(`/history/${repoId}`);
      const latest = data.history?.[0];
      if (!latest) throw new Error(t('repoDetail.pipeline.shareError'));

      const { data: shareData } = await api.post(`/history/${latest.id}/share`);
      const link = `${window.location.origin}/share/${shareData.shareId}`;
      await navigator.clipboard.writeText(link);
      setShared(true);
      setTimeout(() => setShared(false), 1500);
    } catch (err) {
      setError(err?.response?.data?.error ?? err.message ?? t('repoDetail.pipeline.shareError'));
    } finally {
      setSharing(false);
    }
  }

  function startEdit(name) {
    setEditingStep(name);
    setStepName(name);
    setCommand(extractStepRunCommand(pipeline.yaml_content, name));
    setError('');
  }

  function cancelEdit() {
    setEditingStep(null);
    setStepName('');
    setCommand('');
  }

  async function handleDeleteStep(name) {
    setDeletingStep(name);
    setError('');
    try {
      await api.put(`/pipeline/${repoId}`, { operation: 'delete', stepName: name });
      if (editingStep === name) cancelEdit();
      await onChanged();
    } catch (err) {
      setError(err?.response?.data?.error ?? t('repoDetail.pipeline.error'));
    } finally {
      setDeletingStep(null);
    }
  }

  async function handleSubmitStep(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await api.put(`/pipeline/${repoId}`, {
        operation: editingStep ? 'edit' : 'add',
        stepName,
        step: { run: command },
      });
      cancelEdit();
      await onChanged();
    } catch (err) {
      setError(err?.response?.data?.error ?? t('repoDetail.pipeline.error'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="repo-detail-panel">
      <h2 className="repo-detail-panel-title">{t('repoDetail.pipeline.title')}</h2>
      <p className="repo-detail-panel-subtitle">{t('repoDetail.pipeline.subtitle')}</p>

      {steps.length > 0 && (
        <div className="card step-flow-card">
          <h3 className="overview-card-title">{t('repoDetail.pipeline.stepFlowTitle')}</h3>
          <div className="step-flow">
            {steps.map((step, index) => (
              <div className="step-flow-item" key={step}>
                <span className="step-flow-chip">{step}</span>
                {index < steps.length - 1 && <ChevronRightIcon />}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="yaml-card">
        <div className="yaml-card-head">
          <span className="yaml-card-title">{t('repoDetail.pipeline.yamlTitle')}</span>
          <div className="yaml-card-actions">
            <button type="button" className="yaml-action" onClick={handleCopy}>
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? t('repoDetail.pipeline.copied') : t('repoDetail.pipeline.copy')}
            </button>
            <button type="button" className="yaml-action" onClick={handleDownload}>
              <DownloadIcon />
              {t('repoDetail.pipeline.download')}
            </button>
            <button type="button" className="yaml-action" onClick={handleShare} disabled={sharing}>
              {shared ? <CheckIcon /> : <ShareIcon />}
              {shared ? t('repoDetail.pipeline.shared') : t('repoDetail.pipeline.share')}
            </button>
          </div>
        </div>
        <pre className="yaml-card-body">{pipeline.yaml_content}</pre>
      </div>

      {editableSteps.length > 0 && (
        <div className="card step-editor-card">
          <h3 className="overview-card-title">{t('repoDetail.pipeline.manageTitle')}</h3>
          <ul className="step-manage-list">
            {editableSteps.map((name) => (
              <li key={name} className="step-manage-item">
                <span>{name}</span>
                <div className="step-manage-actions">
                  <button type="button" className="btn btn-muted step-manage-btn" onClick={() => startEdit(name)}>
                    {t('common.edit')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger step-manage-btn"
                    onClick={() => handleDeleteStep(name)}
                    disabled={deletingStep === name}
                  >
                    {deletingStep === name ? t('common.deleting') : t('common.delete')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card step-editor-card">
        <h3 className="overview-card-title">
          {editingStep ? t('repoDetail.pipeline.editorEditTitle') : t('repoDetail.pipeline.editorTitle')}
        </h3>
        {error && <p className="form-error">{error}</p>}
        <form className="step-editor-form" onSubmit={handleSubmitStep}>
          <div className="field">
            <label className="field-label" htmlFor="stepName">
              {t('repoDetail.pipeline.stepNameLabel')}
            </label>
            <input
              id="stepName"
              className="field-input"
              type="text"
              placeholder={t('repoDetail.pipeline.stepNamePlaceholder')}
              value={stepName}
              onChange={(event) => setStepName(event.target.value)}
              disabled={Boolean(editingStep)}
              required
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="command">
              {t('repoDetail.pipeline.commandLabel')}
            </label>
            <input
              id="command"
              className="field-input"
              type="text"
              placeholder={t('repoDetail.pipeline.commandPlaceholder')}
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              required
            />
          </div>
          {!editingStep && (
            <div className="field">
              <label className="field-label" htmlFor="position">
                {t('repoDetail.pipeline.positionLabel')}
              </label>
              <select
                id="position"
                className="field-input"
                value={position}
                onChange={(event) => setPositionOverride(event.target.value)}
              >
                {steps.map((step) => (
                  <option key={step} value={step}>
                    {t('repoDetail.pipeline.positionAfter', { step })}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="step-editor-form-actions">
            <button type="submit" className="btn btn-primary step-editor-submit" disabled={submitting}>
              {submitting
                ? t('repoDetail.pipeline.adding')
                : editingStep
                  ? t('common.save')
                  : t('repoDetail.pipeline.addStep')}
            </button>
            {editingStep && (
              <button type="button" className="btn btn-muted" onClick={cancelEdit} disabled={submitting}>
                {t('common.cancel')}
              </button>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}

const HISTORY_BADGE_KEY = {
  ADD: 'added',
  EDIT: 'edited',
  DELETE: 'deleted',
};

function describeHistoryEntry(entry) {
  if (entry.action === 'ADD') return `Added ${entry.step_name} step`;
  if (entry.action === 'DELETE') return `Removed ${entry.step_name} step`;
  return `Edited ${entry.step_name} step`;
}

function HistorySkeleton() {
  return (
    <ul className="history-timeline" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <li key={index} className="history-item">
          <span className="skeleton" style={{ width: 10, height: 10, borderRadius: '50%', marginTop: 18 }} />
          <div style={{ flex: 1 }}>
            <span className="skeleton" style={{ width: '45%', height: 14, marginBottom: 8 }} />
            <span className="skeleton" style={{ width: '25%', height: 12 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function HistoryTab({ history, onChanged }) {
  const [sharedId, setSharedId] = useState(null);
  const [revertingId, setRevertingId] = useState(null);
  const [viewingId, setViewingId] = useState(null);

  if (history === null) {
    return <HistorySkeleton />;
  }

  if (!history.length) {
    return <p className="dashboard-state">{t('repoDetail.history.empty')}</p>;
  }

  async function handleShare(entry) {
    const { data } = await api.post(`/history/${entry.id}/share`);
    const link = `${window.location.origin}/share/${data.shareId}`;
    await navigator.clipboard.writeText(link);
    setSharedId(entry.id);
    setTimeout(() => setSharedId(null), 1500);
  }

  async function handleRevert(entry) {
    setRevertingId(entry.id);
    try {
      await api.post(`/history/${entry.id}/revert`);
      await onChanged();
    } finally {
      setRevertingId(null);
    }
  }

  return (
    <section className="repo-detail-panel">
      <h2 className="repo-detail-panel-title">{t('repoDetail.history.title')}</h2>
      <p className="repo-detail-panel-subtitle">{t('repoDetail.history.subtitle')}</p>

      <ol className="history-timeline">
        {history.map((entry) => (
          <li key={entry.id} className="history-item">
            <span className={`history-dot history-dot-${HISTORY_BADGE_KEY[entry.action]}`} />
            <div className="card history-card">
              <div className="history-card-head">
                <span className={`history-badge history-badge-${HISTORY_BADGE_KEY[entry.action]}`}>
                  {t(`repoDetail.history.${HISTORY_BADGE_KEY[entry.action]}`)}
                </span>
                <strong>{entry.step_name}</strong>
                <span className="history-card-time">{relativeTime(entry.created_at)}</span>
              </div>
              <p className="history-card-body">{describeHistoryEntry(entry)}</p>

              {viewingId === entry.id && (
                <pre className="history-yaml-preview">
                  {JSON.stringify(entry.after_state ?? entry.before_state, null, 2)}
                </pre>
              )}

              <div className="history-card-actions">
                <button
                  type="button"
                  className="history-action"
                  onClick={() => setViewingId(viewingId === entry.id ? null : entry.id)}
                >
                  {t('repoDetail.history.viewYaml')}
                </button>
                <button type="button" className="history-action" onClick={() => handleShare(entry)}>
                  {sharedId === entry.id
                    ? t('repoDetail.history.shared')
                    : t('repoDetail.history.share')}
                </button>
                <button
                  type="button"
                  className="history-action"
                  onClick={() => handleRevert(entry)}
                  disabled={revertingId === entry.id}
                >
                  <UndoIcon size={12} />
                  {revertingId === entry.id
                    ? t('repoDetail.history.reverting')
                    : t('repoDetail.history.revert')}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

const RECOMMENDATION_GROUPS = [
  { type: 'linting', labelKey: 'groupWarnings', icon: AlertTriangleIcon, tone: 'warning' },
  { type: 'performance', labelKey: 'groupSuggestions', icon: LightbulbIcon, tone: 'suggestion' },
  { type: 'security', labelKey: 'groupSecurity', icon: ShieldAlertIcon, tone: 'security' },
];

function RecommendationsSkeleton() {
  return (
    <div aria-hidden="true">
      {Array.from({ length: 2 }).map((_, groupIndex) => (
        <div key={groupIndex} className="recommendation-group">
          <span className="skeleton" style={{ width: 140, height: 14, marginBottom: 12 }} />
          <ul className="recommendation-list">
            {Array.from({ length: 2 }).map((__, itemIndex) => (
              <li key={itemIndex} className="card recommendation-item">
                <span
                  className="skeleton"
                  style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }}
                />
                <div style={{ flex: 1 }}>
                  <span className="skeleton" style={{ width: '40%', height: 14, marginBottom: 8 }} />
                  <span className="skeleton" style={{ width: '90%', height: 12 }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function RecommendationsTab({ repoId, recommendations, onApplied }) {
  const [dismissed, setDismissed] = useState({});
  const [applied, setApplied] = useState({});
  const [applyingIndex, setApplyingIndex] = useState(null);
  const [applyErrors, setApplyErrors] = useState({});

  if (recommendations === null) {
    return <RecommendationsSkeleton />;
  }

  const visible = recommendations.filter((_, index) => !dismissed[index]);

  if (!visible.length) {
    return <p className="dashboard-state">{t('repoDetail.recommendations.empty')}</p>;
  }

  async function handleApply(index, title) {
    setApplyingIndex(index);
    setApplyErrors((prev) => ({ ...prev, [index]: '' }));
    try {
      await api.post(`/pipeline/${repoId}/apply-recommendation`, { title });
      setApplied((prev) => ({ ...prev, [index]: true }));
      await onApplied();
    } catch (err) {
      setApplyErrors((prev) => ({
        ...prev,
        [index]: err?.response?.data?.error ?? t('repoDetail.recommendations.applyError'),
      }));
    } finally {
      setApplyingIndex(null);
    }
  }

  return (
    <section className="repo-detail-panel">
      <h2 className="repo-detail-panel-title">{t('repoDetail.recommendations.title')}</h2>
      <p className="repo-detail-panel-subtitle">{t('repoDetail.recommendations.subtitle')}</p>

      {RECOMMENDATION_GROUPS.map((group) => {
        const items = recommendations
          .map((rec, index) => ({ rec, index }))
          .filter(({ rec, index }) => rec.type === group.type && !dismissed[index]);

        if (!items.length) return null;

        const GroupIcon = group.icon;

        return (
          <div className="recommendation-group" key={group.type}>
            <h3 className="recommendation-group-title">
              {t(`repoDetail.recommendations.${group.labelKey}`)}
            </h3>
            <ul className="recommendation-list">
              {items.map(({ rec, index }) => (
                <li key={index} className={`card recommendation-item recommendation-item-${group.tone}`}>
                  <span className={`recommendation-icon recommendation-icon-${group.tone}`}>
                    <GroupIcon size={16} />
                  </span>
                  <div className="recommendation-body">
                    <strong className="recommendation-title">{rec.title ?? rec.suggestion}</strong>
                    <p className="recommendation-text">{rec.suggestion}</p>
                    {applyErrors[index] && <p className="form-error">{applyErrors[index]}</p>}
                  </div>
                  <div className="recommendation-actions">
                    <button
                      type="button"
                      className="btn btn-secondary recommendation-action"
                      onClick={() => handleApply(index, rec.title)}
                      disabled={applied[index] || applyingIndex === index}
                    >
                      {applied[index]
                        ? t('repoDetail.recommendations.applied')
                        : applyingIndex === index
                          ? t('repoDetail.recommendations.applying')
                          : t('repoDetail.recommendations.apply')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-muted recommendation-action"
                      onClick={() => setDismissed((prev) => ({ ...prev, [index]: true }))}
                    >
                      {t('repoDetail.recommendations.ignore')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

