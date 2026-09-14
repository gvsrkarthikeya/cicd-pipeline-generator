// GitHub Actions YAML Generator
// Takes the inference engine's `decisions` object and builds a valid
// GitHub Actions workflow, serialized with js-yaml. Language-specific job
// steps are assembled from the decisions' `steps`/`commands`, and the
// result is round-tripped through the YAML parser to guarantee valid syntax.

import { dump, load } from 'js-yaml';

// setup-action + version input per language
const SETUP_ACTION = {
    nodejs: { uses: 'actions/setup-node@v4', versionKey: 'node-version' },
    python: { uses: 'actions/setup-python@v5', versionKey: 'python-version' },
    java: { uses: 'actions/setup-java@v4', versionKey: 'java-version' }
};

// Build the ordered list of GitHub Actions step objects for a language
const buildSteps = (decisions) => {
    const { language, runtimeVersion, buildTool, commands, steps } = decisions;
    const jobSteps = [
        { name: 'Checkout code', uses: 'actions/checkout@v4' }
    ];

    if (!language) {
        // Unknown stack — checkout only, nothing else to run
        return jobSteps;
    }

    const setup = SETUP_ACTION[language];
    if (setup) {
        const setupStep = { name: `Set up ${language}`, uses: setup.uses };
        setupStep.with = { [setup.versionKey]: runtimeVersion };
        if (language === 'java') {
            setupStep.with.distribution = 'temurin';
        }
        jobSteps.push(setupStep);
    }

    if (steps.includes('install')) {
        if (language === 'java') {
            const runCmd = buildTool === 'maven' ? 'mvn -B install' : './gradlew build';
            jobSteps.push({ name: 'Build project', run: runCmd });
        } else {
            jobSteps.push({ name: 'Install dependencies', run: commands.install });
        }
    }

    if (steps.includes('lint') && commands?.lint) {
        jobSteps.push({ name: 'Run lint', run: commands.lint });
    }

    if (steps.includes('test') && commands?.test) {
        jobSteps.push({ name: 'Run tests', run: commands.test });
    } else if (language === 'java') {
        // Maven/Gradle run tests as part of the build step; no separate command
    }

    if (steps.includes('build') && commands?.build) {
        jobSteps.push({ name: 'Build project', run: commands.build });
    }

    return jobSteps;
};

// Add a deployment step/comment based on the resolved deployment strategy.
// No real deploy credentials are wired up yet — this adds a clearly labeled
// placeholder step so the workflow documents the intended strategy.
const buildDeploymentStep = (decisions) => {
    const { deploymentStrategy } = decisions;

    const placeholders = {
        container: { name: 'Build and push Docker image (placeholder)', run: 'echo "TODO: docker build && docker push"' },
        static: { name: 'Deploy static build (placeholder)', run: 'echo "TODO: deploy build output to static host"' },
        server: { name: 'Deploy to server (placeholder)', run: 'echo "TODO: deploy to server"' },
        generic: { name: 'Deploy (placeholder)', run: 'echo "TODO: define deployment for this project"' }
    };

    return placeholders[deploymentStrategy] || placeholders.generic;
};

// Main entry point — takes the inference engine's { decisions, ... } output
// and returns a validated GitHub Actions YAML string
export const generateYaml = (inferenceResult, repoName = 'pipeline') => {
    if (!inferenceResult || !inferenceResult.success) {
        return {
            success: false,
            error: 'Cannot generate YAML from a failed inference result'
        };
    }

    const { decisions } = inferenceResult;
    const reasoning = [];

    const jobSteps = buildSteps(decisions);
    reasoning.push({
        step: 'yaml_steps',
        signal: `Resolved steps: ${decisions.steps.join(', ')}`,
        inference: `Generated ${jobSteps.length} job step(s)`,
        confidence: inferenceResult.confidence
    });

    jobSteps.push(buildDeploymentStep(decisions));
    reasoning.push({
        step: 'yaml_deployment',
        signal: `Deployment strategy: ${decisions.deploymentStrategy}`,
        inference: 'Added deployment placeholder step matching the resolved strategy',
        confidence: inferenceResult.confidence
    });

    const workflow = {
        name: `${repoName} CI/CD`,
        on: {
            push: { branches: ['main'] },
            pull_request: { branches: ['main'] }
        },
        jobs: {
            build: {
                'runs-on': 'ubuntu-latest',
                steps: jobSteps
            }
        }
    };

    const yamlString = dump(workflow, { noRefs: true, lineWidth: -1 });

    // Validate syntax by round-tripping through the parser
    try {
        load(yamlString);
    } catch (err) {
        return {
            success: false,
            error: `Generated YAML failed validation: ${err.message}`
        };
    }

    return {
        success: true,
        yaml: yamlString,
        reasoning
    };
};
