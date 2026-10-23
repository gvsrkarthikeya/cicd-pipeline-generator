import { useState } from 'react';
import { t } from '../lib/i18n';
import { XIcon } from './icons';
import api from '../lib/api';
import './AddRepoModal.css';

export default function AddRepoModal({ onClose, onAdded }) {
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [githubToken, setGithubToken] = useState('');
  const [tokenDraft, setTokenDraft] = useState('');
  const [authorizing, setAuthorizing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleAuthorize(event) {
    event.preventDefault();
    const draft = tokenDraft.trim();
    if (!draft) return;
    if (!repoUrl.trim()) {
      setTokenError(t('addRepo.tokenNeedsUrl'));
      return;
    }

    setTokenError('');
    setVerifying(true);
    try {
      await api.post('/repos/verify-token', { repoUrl: repoUrl.trim(), githubToken: draft });
      setGithubToken(draft);
      setAuthorizing(false);
    } catch (err) {
      setTokenError(err?.response?.data?.error ?? t('addRepo.tokenInvalid'));
    } finally {
      setVerifying(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (isPrivate && !githubToken) {
      setError(t('addRepo.tokenRequired'));
      return;
    }

    setSubmitting(true);

    try {
      await onAdded({
        repoUrl,
        branch: branch.trim() || undefined,
        isPrivate,
        githubToken: isPrivate ? githubToken : undefined,
      });
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error ?? t('addRepo.error'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="card modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-repo-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="add-repo-title" className="modal-title">
            {t('addRepo.title')}
          </h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label={t('common.cancel')}
          >
            <XIcon size={16} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          {error && <p className="form-error">{error}</p>}

          <div className="field">
            <label className="field-label" htmlFor="repoUrl">
              {t('addRepo.urlLabel')}
            </label>
            <input
              id="repoUrl"
              className="field-input"
              type="url"
              placeholder={t('addRepo.urlPlaceholder')}
              value={repoUrl}
              onChange={(event) => setRepoUrl(event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="branch">
              {t('addRepo.branchLabel')}{' '}
              <span className="field-optional">{t('addRepo.branchOptional')}</span>
            </label>
            <input
              id="branch"
              className="field-input"
              type="text"
              placeholder={t('addRepo.branchPlaceholder')}
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
            />
          </div>

          <div className="field">
            <span className="field-label">{t('addRepo.visibilityLabel')}</span>
            <div className="visibility-options">
              <button
                type="button"
                className={'visibility-option' + (!isPrivate ? ' visibility-option-active' : '')}
                onClick={() => setIsPrivate(false)}
              >
                <span className="visibility-radio" aria-hidden="true" />
                {t('addRepo.visibilityPublic')}
              </button>
              <button
                type="button"
                className={'visibility-option' + (isPrivate ? ' visibility-option-active' : '')}
                onClick={() => setIsPrivate(true)}
              >
                <span className="visibility-radio" aria-hidden="true" />
                {t('addRepo.visibilityPrivate')}
              </button>
            </div>
          </div>

          {isPrivate && (
            <div className="private-auth">
              {githubToken ? (
                <p className="private-auth-status">{t('addRepo.tokenConnected')}</p>
              ) : (
                <>
                  <p className="private-auth-notice">{t('addRepo.privateNotice')}</p>
                  {authorizing ? (
                    <div className="private-auth-form">
                      <input
                        className="field-input"
                        type="password"
                        placeholder={t('addRepo.tokenPlaceholder')}
                        value={tokenDraft}
                        onChange={(event) => {
                          setTokenDraft(event.target.value);
                          setTokenError('');
                        }}
                        autoFocus
                      />
                      <p className="private-auth-hint">{t('addRepo.tokenHint')}</p>
                      {tokenError && <p className="form-error private-auth-error">{tokenError}</p>}
                      <button
                        type="button"
                        className="btn btn-secondary private-auth-connect"
                        onClick={handleAuthorize}
                        disabled={!tokenDraft.trim() || verifying}
                      >
                        {verifying ? t('addRepo.tokenVerifying') : t('addRepo.tokenConnect')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setAuthorizing(true)}
                    >
                      {t('addRepo.authorizeGithub')}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? t('addRepo.submitting') : t('addRepo.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
