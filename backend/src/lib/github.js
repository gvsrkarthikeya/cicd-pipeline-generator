import { Octokit } from '@octokit/rest';

// Create octokit instance with optional token
const getOctokit = (token = null) => {
    return new Octokit({
        auth: token || process.env.GITHUB_TOKEN || undefined,
        log: {
            debug: () => { },
            info: () => { },
            warn: () => { },
            error: () => { }
        }
    });
};

// Parse owner and repo from URL
// e.g. https://github.com/facebook/react → { owner: 'facebook', repo: 'react' }
export const parseRepoUrl = (repoUrl) => {
    const cleaned = repoUrl
        .replace('https://github.com/', '')
        .replace('http://github.com/', '')
        .replace(/\.git$/, '')
        .replace(/\/$/, '');

    const parts = cleaned.split('/');
    if (parts.length < 2) throw new Error('Invalid GitHub URL');

    return { owner: parts[0], repo: parts[1] };
};

// Fetch complete file tree of a repo
export const getFileTree = async (repoUrl, branch = 'main', token = null) => {
    const { owner, repo } = parseRepoUrl(repoUrl);
    const octokit = getOctokit(token);

    try {
        const { data } = await octokit.rest.git.getTree({
            owner,
            repo,
            tree_sha: branch,
            recursive: '1'
        });

        // Return just the file paths
        return data.tree
            .filter(item => item.type === 'blob')
            .map(item => item.path);

    } catch (err) {
        if (err.status === 404) throw new Error('Repository not found or no access');
        if (err.status === 401) throw new Error('Invalid or missing token for private repo');
        throw new Error(`GitHub API error: ${err.message}`);
    }
};

// Fetch contents of a specific file
export const getFileContent = async (repoUrl, filePath, branch = 'main', token = null) => {
    const { owner, repo } = parseRepoUrl(repoUrl);
    const octokit = getOctokit(token);

    try {
        const { data } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: filePath,
            ref: branch
        });

        // If it's a directory, return null
        if (Array.isArray(data)) return null;

        // If no content field, return null
        if (!data.content) return null;

        // Content is base64 encoded — decode it
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        return content;

    } catch (err) {
        if (err.status === 404) return null;
        throw new Error(`Could not read ${filePath}: ${err.message}`);
    }
};

// Fetch multiple key files at once
export const getKeyFiles = async (repoUrl, branch = 'main', token = null) => {
    const keyFiles = [
        'package.json',
        'requirements.txt',
        'pom.xml',
        'build.gradle',
        'setup.py',
        'pyproject.toml',
        'Dockerfile',
        'docker-compose.yml',
        '.github/workflows',
        'Makefile'
    ];

    const results = {};

    await Promise.all(
        keyFiles.map(async (file) => {
            const content = await getFileContent(repoUrl, file, branch, token);
            if (content !== null) {
                results[file] = content;
            }
        })
    );

    return results;
};