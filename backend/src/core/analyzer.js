import { getFileTree, getKeyFiles } from '../lib/github.js';

// Key files that indicate specific stacks
const INDICATORS = {
    nodejs: ['package.json'],
    python: ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile'],
    java: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
    docker: ['Dockerfile', 'docker-compose.yml'],
    existing_ci: ['.github/workflows']
};

// Detect which indicator files are present in the file tree
const detectFiles = (fileTree) => {
    const detected = {};

    for (const [stack, files] of Object.entries(INDICATORS)) {
        detected[stack] = files.some(f =>
            fileTree.some(path => path === f || path.startsWith(f + '/'))
        );
    }

    return detected;
};

// Parse package.json to extract deeper signals
const parsePackageJson = (content) => {
    try {
        const pkg = JSON.parse(content);
        return {
            dependencies: Object.keys(pkg.dependencies || {}),
            devDependencies: Object.keys(pkg.devDependencies || {}),
            scripts: Object.keys(pkg.scripts || {}),
            hasTest: !!(pkg.scripts?.test && pkg.scripts.test !== 'echo "Error: no test specified"'),
        };
    } catch {
        return { dependencies: [], devDependencies: [], scripts: [], hasTest: false };
    }
};

// Detect framework from package.json dependencies
const detectNodeFramework = (deps, devDeps) => {
    const all = [...deps, ...devDeps];
    if (all.includes('react')) return { name: 'react', type: 'frontend' };
    if (all.includes('next')) return { name: 'next', type: 'fullstack' };
    if (all.includes('vue')) return { name: 'vue', type: 'frontend' };
    if (all.includes('angular')) return { name: 'angular', type: 'frontend' };
    if (all.includes('express')) return { name: 'express', type: 'backend' };
    if (all.includes('fastify')) return { name: 'fastify', type: 'backend' };
    if (all.includes('nestjs') || all.includes('@nestjs/core')) return { name: 'nestjs', type: 'backend' };
    return { name: null, type: 'backend' }; // default Node to backend
};

// Detect test framework from package.json
const detectTestFramework = (deps, devDeps) => {
    const all = [...deps, ...devDeps];
    if (all.includes('jest')) return 'jest';
    if (all.includes('mocha')) return 'mocha';
    if (all.includes('vitest')) return 'vitest';
    if (all.includes('jasmine')) return 'jasmine';
    return null;
};

// Detect linter from package.json
const detectLinter = (deps, devDeps) => {
    const all = [...deps, ...devDeps];
    if (all.includes('eslint')) return 'eslint';
    if (all.includes('prettier')) return 'prettier';
    return null;
};

// Parse requirements.txt to extract Python packages
const parsePythonRequirements = (content) => {
    return content
        .split('\n')
        .map(line => line.trim().toLowerCase().split(/[>=<!]/)[0])
        .filter(line => line && !line.startsWith('#'));
};

// Heuristically extract known package names from pyproject.toml or setup.py content
// (these files use TOML / Python syntax rather than plain requirement lines, so we
// scan for known framework/test package names instead of fully parsing them)
const KNOWN_PYTHON_PACKAGES = ['django', 'flask', 'fastapi', 'pytest', 'unittest'];
const extractPythonPackageNames = (content) => {
    const lower = content.toLowerCase();
    return KNOWN_PYTHON_PACKAGES.filter(pkg => new RegExp(`\\b${pkg}\\b`).test(lower));
};

// Detect Python framework
const detectPythonFramework = (packages) => {
    if (packages.includes('django')) return { name: 'django', type: 'backend' };
    if (packages.includes('flask')) return { name: 'flask', type: 'backend' };
    if (packages.includes('fastapi')) return { name: 'fastapi', type: 'backend' };
    return { name: null, type: 'backend' };
};

// Detect Python test framework
const detectPythonTestFramework = (packages) => {
    if (packages.includes('pytest')) return 'pytest';
    if (packages.includes('unittest')) return 'unittest';
    return null;
};

// Determine language, framework, test framework, linter and build tool for a
// single project directory (the repo root, or one folder of a monorepo).
// `detected` and `keyFiles` must be relative to that directory.
const detectStack = (detected, keyFiles) => {
    const reasoning = [];
    let language = null;
    let framework = null;
    let projectType = null;
    let testFramework = null;
    let linter = null;
    let buildTool = null;
    let confidence = 0;

    if (detected.nodejs && keyFiles['package.json']) {
        const pkg = parsePackageJson(keyFiles['package.json']);
        const fw = detectNodeFramework(pkg.dependencies, pkg.devDependencies);

        language = 'nodejs';
        framework = fw.name;
        projectType = fw.type;
        testFramework = detectTestFramework(pkg.dependencies, pkg.devDependencies);
        linter = detectLinter(pkg.dependencies, pkg.devDependencies);
        buildTool = 'npm';
        confidence = 0.95;

        reasoning.push({
            step: 'language_detection',
            signal: 'package.json detected',
            inference: `Node.js project identified`,
            confidence: 0.95
        });

        if (framework) {
            reasoning.push({
                step: 'framework_detection',
                signal: `${framework} found in dependencies`,
                inference: `${framework} framework detected — ${projectType} project`,
                confidence: 0.90
            });
        }

        if (testFramework) {
            reasoning.push({
                step: 'test_detection',
                signal: `${testFramework} found in devDependencies`,
                inference: `${testFramework} test framework detected`,
                confidence: 0.88
            });
        }

        if (!linter) {
            reasoning.push({
                step: 'linter_detection',
                signal: 'No linter found in dependencies',
                inference: 'No linting configured — ESLint recommended',
                confidence: null,
                recommendation: true
            });
        }
    }

    else if (detected.python) {
        language = 'python';
        buildTool = 'pip';
        confidence = 0.95;

        reasoning.push({
            step: 'language_detection',
            signal: 'requirements.txt or setup.py detected',
            inference: 'Python project identified',
            confidence: 0.95
        });

        let packages = [];
        let sourceFile = null;

        if (keyFiles['requirements.txt']) {
            packages = parsePythonRequirements(keyFiles['requirements.txt']);
            sourceFile = 'requirements.txt';
        } else if (keyFiles['pyproject.toml']) {
            packages = extractPythonPackageNames(keyFiles['pyproject.toml']);
            sourceFile = 'pyproject.toml';
        } else if (keyFiles['setup.py']) {
            packages = extractPythonPackageNames(keyFiles['setup.py']);
            sourceFile = 'setup.py';
        }

        const fw = detectPythonFramework(packages);
        framework = fw.name;
        projectType = fw.type;
        testFramework = detectPythonTestFramework(packages);

        if (framework) {
            reasoning.push({
                step: 'framework_detection',
                signal: `${framework} found in ${sourceFile}`,
                inference: `${framework} framework detected`,
                confidence: 0.90
            });
        }

        if (testFramework) {
            reasoning.push({
                step: 'test_detection',
                signal: `${testFramework} found in ${sourceFile}`,
                inference: `${testFramework} test framework detected`,
                confidence: 0.88
            });
        }
    }

    else if (detected.java) {
        language = 'java';
        buildTool = keyFiles['pom.xml'] ? 'maven' : 'gradle';
        projectType = 'backend';
        confidence = 0.95;

        reasoning.push({
            step: 'language_detection',
            signal: `${buildTool === 'maven' ? 'pom.xml' : 'build.gradle'} detected`,
            inference: `Java project with ${buildTool} build tool identified`,
            confidence: 0.95
        });
    }

    else {
        // Fallback
        confidence = 0.3;
        reasoning.push({
            step: 'language_detection',
            signal: 'No recognizable stack indicator files found',
            inference: 'Unknown stack — generic pipeline will be generated',
            confidence: 0.3,
            recommendation: true
        });
    }

    return { language, framework, projectType, testFramework, linter, buildTool, confidence, reasoning };
};

// Pick a deployment strategy for a single project directory
const detectDeployment = (detected, projectType, framework) => {
    if (detected.docker) {
        return {
            deploymentStrategy: 'container',
            reasoning: [{
                step: 'deployment_detection',
                signal: 'Dockerfile detected',
                inference: 'Container deployment strategy selected',
                confidence: 1.0
            }]
        };
    }

    if (projectType === 'frontend') {
        return {
            deploymentStrategy: 'static',
            reasoning: [{
                step: 'deployment_detection',
                signal: `Frontend framework (${framework}) detected, no Dockerfile`,
                inference: 'Static deployment strategy selected',
                confidence: 0.85
            }]
        };
    }

    return {
        deploymentStrategy: 'server',
        reasoning: [{
            step: 'deployment_detection',
            signal: 'No Dockerfile found',
            inference: 'Server deployment strategy selected',
            confidence: 0.75
        }]
    };
};

// --- Monorepo support -------------------------------------------------------
// When the repo root has no stack indicator files (e.g. a repo with separate
// `backend/` and `frontend/` folders), look for projects inside sub-folders.

const SUBPROJECT_IGNORED_DIRS = new Set(['node_modules', 'vendor', 'dist', 'build']);
const MAX_SUBPROJECT_DEPTH = 2;
const MAX_SUBPROJECTS = 5;
const STACK_INDICATOR_FILES = [...INDICATORS.nodejs, ...INDICATORS.python, ...INDICATORS.java];

// Find folders (up to MAX_SUBPROJECT_DEPTH levels deep) that directly contain
// a stack indicator file. Nested folders of an already-found project are skipped.
const findSubprojectDirs = (fileTree) => {
    const dirs = new Set();

    for (const path of fileTree) {
        const parts = path.split('/');
        const file = parts.pop();
        if (parts.length < 1 || parts.length > MAX_SUBPROJECT_DEPTH) continue;
        if (parts.some(part => part.startsWith('.') || SUBPROJECT_IGNORED_DIRS.has(part))) continue;
        if (STACK_INDICATOR_FILES.includes(file)) dirs.add(parts.join('/'));
    }

    return [...dirs]
        .sort()
        .filter(dir => ![...dirs].some(other => other !== dir && dir.startsWith(`${other}/`)))
        .slice(0, MAX_SUBPROJECTS);
};

// Scope a reasoning entry to a sub-project so the trail stays readable
const scopeReasoning = (entry, dir) => ({
    ...entry,
    signal: entry.signal ? `[${dir}] ${entry.signal}` : entry.signal,
    inference: entry.inference ? `[${dir}] ${entry.inference}` : entry.inference
});

const analyzeSubproject = async (repoUrl, branch, token, dir, fileTree) => {
    const prefix = `${dir}/`;
    const relativeTree = fileTree
        .filter(path => path.startsWith(prefix))
        .map(path => path.slice(prefix.length));

    const detected = detectFiles(relativeTree);
    const keyFiles = await getKeyFiles(repoUrl, branch, token, dir);
    const stack = detectStack(detected, keyFiles);
    const deployment = detectDeployment(detected, stack.projectType, stack.framework);

    const { reasoning: stackReasoning, ...stackFields } = stack;

    return {
        path: dir,
        ...stackFields,
        deploymentStrategy: deployment.deploymentStrategy,
        hasDocker: detected.docker,
        reasoning: [...stackReasoning, ...deployment.reasoning].map(entry => scopeReasoning(entry, dir))
    };
};

// Roll the per-project deployment strategies up to one repo-level value
const aggregateDeploymentStrategy = (subprojects) => {
    if (subprojects.some(p => p.deploymentStrategy === 'container')) return 'container';
    if (subprojects.some(p => p.deploymentStrategy === 'server')) return 'server';
    return 'static';
};

// Main analyzer function
export const analyzeRepo = async (repoUrl, branch = 'main', token = null) => {
    const reasoning = [];

    try {
        // Step 1 — fetch file tree
        const fileTree = await getFileTree(repoUrl, branch, token);
        reasoning.push({
            step: 'file_tree',
            signal: `Found ${fileTree.length} files in repository`,
            inference: 'Repository accessible and file tree fetched',
            confidence: 1.0
        });

        // Step 2 — detect indicator files
        const detected = detectFiles(fileTree);

        // Step 3 — fetch key file contents
        const keyFiles = await getKeyFiles(repoUrl, branch, token);

        // Step 4 — determine primary language and stack
        const stack = detectStack(detected, keyFiles);

        // Step 4b — nothing recognizable at the root: look for projects in sub-folders
        let subprojects = [];
        if (!stack.language) {
            const dirs = findSubprojectDirs(fileTree);
            const analyzed = await Promise.all(
                dirs.map(dir => analyzeSubproject(repoUrl, branch, token, dir, fileTree))
            );
            subprojects = analyzed.filter(project => project.language);
        }

        // Step 5 — detect deployment strategy
        // Step 6 — check for existing CI
        const ciReasoning = detected.existing_ci
            ? [{
                step: 'existing_ci',
                signal: '.github/workflows directory detected',
                inference: 'Existing CI/CD configuration found — generated pipeline will supplement it',
                confidence: 1.0
            }]
            : [];

        if (subprojects.length > 0) {
            const summary = subprojects.map(p => `${p.path} (${p.language})`).join(', ');
            reasoning.push({
                step: 'monorepo_detection',
                signal: 'No stack indicator files at the repository root',
                inference: `Found ${subprojects.length} project${subprojects.length > 1 ? 's' : ''} in sub-folders: ${summary}`,
                confidence: 0.9
            });
            for (const project of subprojects) reasoning.push(...project.reasoning);
            reasoning.push(...ciReasoning);

            const averageConfidence =
                subprojects.reduce((sum, p) => sum + p.confidence, 0) / subprojects.length;

            return {
                success: true,
                repoUrl,
                branch,
                analysis: {
                    language: null,
                    framework: null,
                    projectType: 'monorepo',
                    testFramework: null,
                    linter: null,
                    buildTool: null,
                    deploymentStrategy: aggregateDeploymentStrategy(subprojects),
                    confidence: Number(averageConfidence.toFixed(2)),
                    hasDocker: detected.docker || subprojects.some(p => p.hasDocker),
                    hasExistingCI: detected.existing_ci,
                    totalFiles: fileTree.length,
                    subprojects: subprojects.map(({ reasoning: _reasoning, ...project }) => project)
                },
                reasoning
            };
        }

        const deployment = detectDeployment(detected, stack.projectType, stack.framework);
        reasoning.push(...stack.reasoning, ...deployment.reasoning, ...ciReasoning);

        return {
            success: true,
            repoUrl,
            branch,
            analysis: {
                language: stack.language,
                framework: stack.framework,
                projectType: stack.projectType,
                testFramework: stack.testFramework,
                linter: stack.linter,
                buildTool: stack.buildTool,
                deploymentStrategy: deployment.deploymentStrategy,
                confidence: stack.confidence,
                hasDocker: detected.docker,
                hasExistingCI: detected.existing_ci,
                totalFiles: fileTree.length
            },
            reasoning
        };

    } catch (err) {
        return {
            success: false,
            error: err.message,
            repoUrl,
            branch
        };
    }
};