// Explainability Engine
// Normalizes and combines the reasoning trails produced by the analyzer,
// inference engine, and YAML generator into one consistent, structured
// explanation report: every entry has { step, signal, rule, inference,
// confidence, action }, grouped by category, plus a flat list of
// recommendations and an overall summary.

// Ensure every trail entry has all fields, even if the source module
// didn't set one (keeps the shape consistent for consumers/UI)
const normalizeEntry = (entry) => ({
    step: entry.step ?? 'unknown',
    signal: entry.signal ?? null,
    rule: entry.rule ?? null,
    inference: entry.inference ?? null,
    confidence: entry.confidence ?? null,
    action: entry.action ?? null,
    recommendation: entry.recommendation ?? false
});

// Group normalized entries by category for easier UI rendering
// (e.g. "Language & Framework Detection", "Pipeline Steps", ...)
const CATEGORY_MAP = {
    file_tree: 'input',
    language_detection: 'detection',
    framework_detection: 'detection',
    test_detection: 'detection',
    linter_detection: 'detection',
    deployment_detection: 'detection',
    existing_ci: 'detection',
    step_selection: 'pipeline_steps',
    deployment_strategy: 'pipeline_steps',
    trigger_selection: 'pipeline_steps',
    yaml_steps: 'yaml_output',
    yaml_deployment: 'yaml_output'
};

const groupByCategory = (entries) => {
    const groups = {
        input: [],
        detection: [],
        pipeline_steps: [],
        yaml_output: [],
        other: []
    };

    for (const entry of entries) {
        const category = CATEGORY_MAP[entry.step] || 'other';
        groups[category].push(entry);
    }

    return groups;
};

// Main entry point — takes the outputs of analyzeRepo(), runInferenceEngine(),
// and generateYaml() and produces one combined, structured explanation report
export const explainDecision = (analyzerResult, inferenceResult, yamlResult = null) => {
    if (!analyzerResult || !analyzerResult.success) {
        return {
            success: false,
            error: 'Cannot explain a failed analysis'
        };
    }
    if (!inferenceResult || !inferenceResult.success) {
        return {
            success: false,
            error: 'Cannot explain a failed inference result'
        };
    }

    // inferenceResult.trail already includes the analyzer's reasoning
    // (see inferenceEngine.js), so start from there and append the
    // YAML generator's reasoning if provided
    const rawTrail = [
        ...inferenceResult.trail,
        ...(yamlResult?.success ? yamlResult.reasoning : [])
    ];

    const trail = rawTrail.map(normalizeEntry);
    const grouped = groupByCategory(trail);
    const recommendations = trail.filter(e => e.recommendation);

    const scored = trail.filter(e => typeof e.confidence === 'number');
    const averageConfidence = scored.length
        ? Number((scored.reduce((sum, e) => sum + e.confidence, 0) / scored.length).toFixed(2))
        : null;

    return {
        success: true,
        summary: {
            totalDecisions: trail.length,
            overallConfidence: inferenceResult.confidence,
            averageStepConfidence: averageConfidence,
            recommendationCount: recommendations.length
        },
        trail,
        grouped,
        recommendations
    };
};

