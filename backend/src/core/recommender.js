// Recommendation Engine
// Analyzes the analyzer + inference engine output (and optionally the
// generated YAML) and produces categorized suggestions across three
// categories: performance, linting, security. These are separate from the
// explainability engine's "recommendation" trail entries — this module
// focuses specifically on pipeline optimization advice.

const CACHE_KEY = {
    nodejs: 'npm',
    python: 'pip'
};

// A repo is either a single project or a monorepo with several sub-projects;
// recommendations are evaluated per project and then merged.
const projectsOf = (analysis, decisions) => (
    analysis.subprojects?.length
        ? analysis.subprojects
        : [{ ...analysis, language: analysis.language ?? decisions.language }]
);

// " (backend, frontend)" for monorepo projects, empty for a single project
const whereSuffix = (projects) => {
    const paths = projects.map((p) => p.path).filter(Boolean);
    return paths.length ? ` (${paths.join(', ')})` : '';
};

// Performance suggestions: dependency caching, matrix builds, parallel jobs
const performanceRecommendations = (analysis, decisions) => {
    const recs = [];
    const projects = projectsOf(analysis, decisions);
    const isMonorepo = Boolean(analysis.subprojects?.length);

    const cacheable = projects.filter((p) => p.language && CACHE_KEY[p.language]);
    const javaProjects = projects.filter((p) => p.language === 'java');

    if (isMonorepo && (cacheable.length || javaProjects.length)) {
        recs.push({
            type: 'performance',
            title: 'Add dependency caching',
            suggestion: `Enable dependency caching in the setup action of each project${whereSuffix([...cacheable, ...javaProjects])} to speed up repeated installs`,
            severity: 'medium'
        });
    } else if (cacheable.length) {
        recs.push({
            type: 'performance',
            title: 'Add dependency caching',
            suggestion: `Enable dependency caching (cache: '${CACHE_KEY[cacheable[0].language]}') in the setup action to speed up repeated installs`,
            severity: 'medium'
        });
    } else if (javaProjects.length) {
        recs.push({
            type: 'performance',
            title: 'Add dependency caching',
            suggestion: 'Enable dependency caching for Maven (~/.m2) or Gradle (~/.gradle/caches) to speed up builds',
            severity: 'medium'
        });
    }

    if (decisions.deploymentStrategy === 'container') {
        recs.push({
            type: 'performance',
            title: 'Cache Docker layers',
            suggestion: 'Use Docker layer caching (e.g. buildx with cache-from/cache-to) to speed up image builds',
            severity: 'medium'
        });
    }

    if (projects.some((p) => p.projectType === 'backend' && p.language)) {
        recs.push({
            type: 'performance',
            title: 'Parallelize lint and test',
            suggestion: 'Consider running lint/test/build steps as parallel jobs instead of sequential steps to reduce total pipeline time',
            severity: 'low'
        });
    }

    return recs;
};

// Linting suggestions
const lintingRecommendations = (analysis, decisions) => {
    const recs = [];
    const projects = projectsOf(analysis, decisions);

    const withoutLinter = projects.filter((p) => !p.linter);
    if (withoutLinter.length) {
        const pythonOnly = withoutLinter.every((p) => p.language === 'python');
        const noPython = withoutLinter.every((p) => p.language !== 'python');
        const advice = pythonOnly
            ? 'flake8 or ruff'
            : noPython
                ? 'ESLint or Prettier'
                : 'ESLint or Prettier (JavaScript) and flake8 or ruff (Python)';

        recs.push({
            type: 'linting',
            title: 'No linter detected',
            suggestion: `Your pipeline has no lint step${whereSuffix(withoutLinter)}. Consider adding ${advice} to catch issues early.`,
            severity: 'medium'
        });
    }

    const withoutTests = projects.filter((p) => !p.testFramework);
    if (withoutTests.length) {
        recs.push({
            type: 'linting',
            title: 'No test framework detected',
            suggestion: `Consider adding one (Jest/Mocha/PyTest/JUnit)${whereSuffix(withoutTests)} so CI can catch regressions`,
            severity: 'high'
        });
    }

    return recs;
};

// Security suggestions — always applicable regardless of stack
const securityRecommendations = (analysis, decisions) => {
    const recs = [
        {
            type: 'security',
            title: 'Pin GitHub Actions to a commit SHA',
            suggestion: 'Pin third-party GitHub Actions to a full commit SHA instead of a mutable version tag (e.g. actions/checkout@<sha>) to prevent supply-chain tampering',
            severity: 'medium'
        },
        {
            type: 'security',
            title: 'Scope workflow permissions',
            suggestion: 'Add an explicit `permissions:` block scoped to the minimum required (e.g. contents: read) instead of relying on default token permissions',
            severity: 'medium'
        }
    ];

    if (decisions.deploymentStrategy === 'server' || decisions.deploymentStrategy === 'container') {
        recs.push({
            type: 'security',
            title: 'Avoid hardcoded tokens',
            suggestion: 'Move API tokens to GitHub Secrets instead of embedding them in workflow files',
            severity: 'high'
        });
    }

    if (!analysis.hasExistingCI) {
        recs.push({
            type: 'security',
            title: 'No existing CI/CD detected',
            suggestion: 'Review the generated workflow before enabling it on protected branches',
            severity: 'low'
        });
    }

    return recs;
};

// Main entry point — takes the analyzer's analysis object and the inference
// engine's decisions object, returns categorized recommendations
export const recommendOptimizations = (analyzerResult, inferenceResult) => {
    if (!analyzerResult || !analyzerResult.success) {
        return {
            success: false,
            error: 'Cannot generate recommendations from a failed analysis'
        };
    }
    if (!inferenceResult || !inferenceResult.success) {
        return {
            success: false,
            error: 'Cannot generate recommendations from a failed inference result'
        };
    }

    const { analysis } = analyzerResult;
    const { decisions } = inferenceResult;

    const recommendations = [
        ...performanceRecommendations(analysis, decisions),
        ...lintingRecommendations(analysis, decisions),
        ...securityRecommendations(analysis, decisions)
    ];

    return {
        success: true,
        recommendations,
        summary: {
            total: recommendations.length,
            byType: {
                performance: recommendations.filter(r => r.type === 'performance').length,
                linting: recommendations.filter(r => r.type === 'linting').length,
                security: recommendations.filter(r => r.type === 'security').length
            }
        }
    };
};

