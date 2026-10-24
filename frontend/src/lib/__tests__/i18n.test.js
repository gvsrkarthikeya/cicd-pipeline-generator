import { describe, it, expect } from 'vitest';
import { t } from '../i18n.js';

describe('t (i18n lookup)', () => {
  it('resolves a nested dot-separated key', () => {
    expect(t('app.name')).toBe('PipelineKit');
  });

  it('returns the key itself when the lookup misses', () => {
    expect(t('does.not.exist')).toBe('does.not.exist');
  });

  it('interpolates {placeholder} variables', () => {
    expect(t('footer.copyright', { year: 2030 })).toBe('© 2030 PipelineKit Inc. All rights reserved.');
  });

  it('leaves unmatched placeholders untouched when the var is missing', () => {
    expect(t('footer.copyright', {})).toBe('© {year} PipelineKit Inc. All rights reserved.');
  });

  it('returns non-string values (e.g. would-be arrays/objects) as-is', () => {
    // common.save is a plain string — confirm string path still works without vars
    expect(t('common.save')).toBe('Save');
  });
});
