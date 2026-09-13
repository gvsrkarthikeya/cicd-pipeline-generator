// Rule-based inference engine
// Takes the raw analyzer output and turns it into concrete pipeline decisions
// (runtime, package manager, steps, deployment strategy) with a weighted
// confidence score and a decision trail matching the explainability format.

// Default runtime versions used when the repo doesn't pin one explicitly
const DEFAULT_VERSIONS = {
    nodejs: '20',
    python: '3.11',
    java: '17'
};

// Package manager + step commands per language/build tool
const COMMANDS = {
    nodejs: {
        install: 'npm ci',
        lint: 'npm run lint',
        test: 'npm test',
        build: 'npm run build'
    },
    python: {
        install: 'pip install -r requirements.txt',
        lint: null, // no default linter command unless one is detected
        test: 'pytest',
        build: null
    },
    java: {
        install: null,
        lint: null,
        test: null,
        build: null
    }
};

// Decide runtime steps for a language given the analysis
const buildLanguageSteps = (analysis, trail) => {
    const steps = ['checkout'];
    const language = analysis.language;

    if (!language) {
        trail.push({
            step: 'step_selection',
            signal: 'No language detected',
            rule: 'Unknown language → generic pipeline',
            inference: 'Only checkout step included',
            confidence: 0.3,
            action: 'Added checkout step only'
        });
        return steps;
    }

    // Install step
    if (language === 'java') {
        const installCmd = analysis.buildTool === 'maven' ? 'mvn install' : 'gradle build';
        steps.push('install');
        trail.push({
            step: 'step_selection',
            signal: `Build tool: ${analysis.buildTool}`,
            rule: `${analysis.buildTool} detected → use ${analysis.buildTool} commands`,
            inference: `Install/build handled via ${installCmd}`,
            confidence: 0.9,
            action: `Added install step (${installCmd})`
        });
    } else {
        steps.push('install');
        trail.push({
            step: 'step_selection',
            signal: `Language: ${language}`,
            rule: `${language} detected → use ${COMMANDS[language].install}`,
            inference: 'Dependency install step added',
            confidence: 0.9,
            action: `Added install step (${COMMANDS[language].install})`
        });
    }

    // Lint step — only if a linter was actually detected
    if (analysis.linter) {
        steps.push('lint');
        trail.push({
            step: 'step_selection',
            signal: `Linter detected: ${analysis.linter}`,
            rule: 'Linter present in project → add lint step',
            inference: 'Lint step added to catch style/quality issues early',
            confidence: 0.85,
            action: 'Added lint step'
        });
    } else {
        trail.push({
            step: 'step_selection',
            signal: 'No linter detected',
            rule: 'No linter configured → skip lint step',
            inference: 'Lint step omitted',
            confidence: null,
            recommendation: true,
            action: 'Recommend adding ESLint/Prettier (or equivalent) for this project'
        });
    }

    // Test step — only if a test framework was detected
    if (analysis.testFramework) {
        steps.push('test');
        trail.push({
            step: 'step_selection',
            signal: `Test framework detected: ${analysis.testFramework}`,
            rule: 'Test framework present → add test step',
            inference: 'Test step added to run project test suite',
            confidence: 0.88,
            action: 'Added test step'
        });
    } else {
        trail.push({
            step: 'step_selection',
            signal: 'No test framework detected',
            rule: 'No test framework configured → skip test step',
            inference: 'Test step omitted',
            confidence: null,
            recommendation: true,
            action: 'Recommend adding a test framework for this project'
        });
    }

    // Build step — only meaningful for frontend/fullstack Node projects
    if (language === 'nodejs' && (analysis.projectType === 'frontend' || analysis.projectType === 'fullstack')) {
        steps.push('build');
        trail.push({
            step: 'step_selection',
            signal: `Project type: ${analysis.projectType}`,
            rule: 'Frontend/fullstack Node project → add build step',
            inference: 'Build step added to produce production assets',
            confidence: 0.85,
            action: 'Added build step'
        });
    }

    return steps;
};

// Decide deployment strategy + action, mirroring the analyzer's signal but
// adding the concrete action taken for the YAML generator to consume
const resolveDeploymentStrategy = (analysis, trail) => {
    const strategy = analysis.deploymentStrategy;

    const actionByStrategy = {
        container: 'Add Docker build + push step',
        static: 'Add build + static host deploy step',
        server: 'Add language-specific deploy/run step',
        generic: 'Add checkout + placeholder run step only'
    };

    trail.push({
        step: 'deployment_strategy',
        signal: analysis.hasDocker ? 'Dockerfile detected' : `Project type: ${analysis.projectType || 'unknown'}`,
        rule: 'Dockerfile present > frontend framework > default server strategy',
        inference: `Deployment strategy resolved to "${strategy}"`,
        confidence: analysis.hasDocker ? 1.0 : (analysis.projectType === 'frontend' ? 0.85 : 0.75),
        action: actionByStrategy[strategy] || actionByStrategy.generic
    });

    return strategy;
};

// Decide CI triggers (kept simple and constant for now — always run on
// push and pull_request against the analyzed branch)
const resolveTriggers = (branch, trail) => {
    const triggers = ['push', 'pull_request'];
    trail.push({
        step: 'trigger_selection',
        signal: `Target branch: ${branch}`,
        rule: 'Default trigger policy → push and pull_request',
        inference: `Pipeline runs on push and pull_request to ${branch}`,
        confidence: 1.0,
        action: `Added push/pull_request triggers for ${branch}`
    });
    return triggers;
};

// Compute an overall weighted confidence from the analyzer confidence and
// the individual decision confidences in the trail
const computeOverallConfidence = (analysisConfidence, trail) => {
    const scored = trail.filter(t => typeof t.confidence === 'number');
    if (scored.length === 0) return analysisConfidence;

    const trailAvg = scored.reduce((sum, t) => sum + t.confidence, 0) / scored.length;

    // Weight the analyzer's own confidence (language/framework detection)
    // higher than individual step decisions, since it's the foundation
    // everything else is built on
    return Number(((analysisConfidence * 0.6) + (trailAvg * 0.4)).toFixed(2));
};

// Main entry point — takes the analyzer's { analysis, reasoning } output
// and returns concrete pipeline decisions + a combined confidence score
export const runInferenceEngine = (analyzerResult, branch = 'main') => {
    if (!analyzerResult || !analyzerResult.success) {
        return {
            success: false,
            error: 'Cannot run inference engine on a failed analysis'
        };
    }

    const { analysis } = analyzerResult;
    const trail = [];

    const steps = buildLanguageSteps(analysis, trail);
    const deploymentStrategy = resolveDeploymentStrategy(analysis, trail);
    const triggers = resolveTriggers(branch, trail);

    const language = analysis.language;
    const runtimeVersion = language ? DEFAULT_VERSIONS[language] : null;

    const decisions = {
        language,
        runtimeVersion,
        buildTool: analysis.buildTool,
        framework: analysis.framework,
        projectType: analysis.projectType,
        steps,
        deploymentStrategy,
        triggers,
        commands: language && COMMANDS[language] ? COMMANDS[language] : null
    };

    const confidence = computeOverallConfidence(analysis.confidence, trail);

    return {
        success: true,
        decisions,
        confidence,
        trail: [...analyzerResult.reasoning, ...trail]
    };
};
