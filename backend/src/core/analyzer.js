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

        // Step 5 — detect deployment strategy
        let deploymentStrategy = 'server';

        if (detected.docker) {
            deploymentStrategy = 'container';
            reasoning.push({
                step: 'deployment_detection',
                signal: 'Dockerfile detected',
                inference: 'Container deployment strategy selected',
                confidence: 1.0
            });
        } else if (projectType === 'frontend') {
            deploymentStrategy = 'static';
            reasoning.push({
                step: 'deployment_detection',
                signal: `Frontend framework (${framework}) detected, no Dockerfile`,
                inference: 'Static deployment strategy selected',
                confidence: 0.85
            });
        } else {
            reasoning.push({
                step: 'deployment_detection',
                signal: 'No Dockerfile found',
                inference: 'Server deployment strategy selected',
                confidence: 0.75
            });
        }

        // Step 6 — check for existing CI
        if (detected.existing_ci) {
            reasoning.push({
                step: 'existing_ci',
                signal: '.github/workflows directory detected',
                inference: 'Existing CI/CD configuration found — generated pipeline will supplement it',
                confidence: 1.0
            });
        }

        return {
            success: true,
            repoUrl,
            branch,
            analysis: {
                language,
                framework,
                projectType,
                testFramework,
                linter,
                buildTool,
                deploymentStrategy,
                confidence,
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