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

// Performance suggestions: dependency caching, matrix builds, parallel jobs
const performanceRecommendations = (analysis, decisions) => {
    const recs = [];

    if (decisions.language && CACHE_KEY[decisions.language]) {
        recs.push({
            type: 'performance',
            suggestion: `Enable dependency caching (cache: '${CACHE_KEY[decisions.language]}') in the setup action to speed up repeated installs`,
            severity: 'medium'
        });
    }

    if (decisions.language === 'java') {
        recs.push({
            type: 'performance',
            suggestion: 'Enable dependency caching for Maven (~/.m2) or Gradle (~/.gradle/caches) to speed up builds',
            severity: 'medium'
        });
    }

    if (decisions.deploymentStrategy === 'container') {
        recs.push({
            type: 'performance',
            suggestion: 'Use Docker layer caching (e.g. buildx with cache-from/cache-to) to speed up image builds',
            severity: 'medium'
        });
    }

    if (analysis.projectType === 'backend' && decisions.language) {
        recs.push({
            type: 'performance',
            suggestion: 'Consider running lint/test/build steps as parallel jobs instead of sequential steps to reduce total pipeline time',
            severity: 'low'
        });
    }

    return recs;
};

// Linting suggestions
const lintingRecommendations = (analysis) => {
    const recs = [];

    if (!analysis.linter) {
        recs.push({
            type: 'linting',
            suggestion: analysis.language === 'python'
                ? 'No linter detected — consider adding flake8 or ruff and a lint step'
                : 'No linter detected — consider adding ESLint (and Prettier for formatting) and a lint step',
            severity: 'medium'
        });
    }

    if (!analysis.testFramework) {
        recs.push({
            type: 'linting',
            suggestion: 'No test framework detected — consider adding one (Jest/Mocha/PyTest/JUnit) so CI can catch regressions',
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
            suggestion: 'Pin third-party GitHub Actions to a full commit SHA instead of a mutable version tag (e.g. actions/checkout@<sha>) to prevent supply-chain tampering',
            severity: 'medium'
        },
        {
            type: 'security',
            suggestion: 'Add an explicit `permissions:` block scoped to the minimum required (e.g. contents: read) instead of relying on default token permissions',
            severity: 'medium'
        }
    ];

    if (decisions.deploymentStrategy === 'server' || decisions.deploymentStrategy === 'container') {
        recs.push({
            type: 'security',
            suggestion: 'Store deployment credentials in GitHub Encrypted Secrets — never hardcode tokens/keys in the workflow file',
            severity: 'high'
        });
    }

    if (!analysis.hasExistingCI) {
        recs.push({
            type: 'security',
            suggestion: 'No existing CI/CD found — review the generated workflow before enabling it on protected branches',
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
        ...lintingRecommendations(analysis),
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

