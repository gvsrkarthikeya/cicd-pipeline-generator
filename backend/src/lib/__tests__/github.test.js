import { describe, it, expect } from 'vitest';
import { parseRepoUrl } from '../github.js';

describe('parseRepoUrl', () => {
  it('parses a standard https github URL', () => {
    expect(parseRepoUrl('https://github.com/facebook/react')).toEqual({
      owner: 'facebook',
      repo: 'react',
    });
  });

  it('parses an http github URL', () => {
    expect(parseRepoUrl('http://github.com/facebook/react')).toEqual({
      owner: 'facebook',
      repo: 'react',
    });
  });

  it('strips a trailing .git suffix', () => {
    expect(parseRepoUrl('https://github.com/facebook/react.git')).toEqual({
      owner: 'facebook',
      repo: 'react',
    });
  });

  it('strips a trailing slash', () => {
    expect(parseRepoUrl('https://github.com/facebook/react/')).toEqual({
      owner: 'facebook',
      repo: 'react',
    });
  });

  it('throws on a URL that is missing the repo segment', () => {
    expect(() => parseRepoUrl('https://github.com/facebook')).toThrow('Invalid GitHub URL');
  });
});
