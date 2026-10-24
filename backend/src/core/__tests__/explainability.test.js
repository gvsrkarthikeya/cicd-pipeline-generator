import { describe, it, expect } from 'vitest';
import { explainDecision } from '../explainability.js';

const analyzerResult = { success: true, analysis: {} };
const inferenceResult = (trail) => ({
  success: true,
  confidence: 0.82,
  trail,
});

describe('explainDecision', () => {
  it('returns success: false when the analyzer result failed', () => {
    const result = explainDecision({ success: false }, inferenceResult([]));
    expect(result.success).toBe(false);
  });

  it('returns success: false when the inference result failed', () => {
    const result = explainDecision(analyzerResult, { success: false });
    expect(result.success).toBe(false);
  });

  it('normalizes trail entries, fills missing fields, and groups by category', () => {
    const trail = [
      { step: 'language_detection', signal: 's', inference: 'i', confidence: 0.9 },
      { step: 'step_selection', signal: 's2', inference: 'i2', confidence: 0.5 },
      { step: 'yaml_steps', signal: 's3', inference: 'i3', confidence: 0.7 },
      { step: 'unmapped_step', signal: 's4', inference: 'i4' },
    ];

    const result = explainDecision(analyzerResult, inferenceResult(trail));

    expect(result.success).toBe(true);
    expect(result.trail).toHaveLength(4);
    // every normalized entry has all expected fields
    for (const entry of result.trail) {
      expect(entry).toHaveProperty('rule');
      expect(entry).toHaveProperty('action');
      expect(entry).toHaveProperty('recommendation');
    }

    expect(result.grouped.detection).toHaveLength(1);
    expect(result.grouped.pipeline_steps).toHaveLength(1);
    expect(result.grouped.yaml_output).toHaveLength(1);
    expect(result.grouped.other).toHaveLength(1);
  });

  it('collects recommendation entries and computes average step confidence', () => {
    const trail = [
      { step: 'a', signal: 's', inference: 'i', confidence: 1.0, recommendation: true },
      { step: 'b', signal: 's', inference: 'i', confidence: 0.5 },
      { step: 'c', signal: 's', inference: 'i', confidence: null },
    ];

    const result = explainDecision(analyzerResult, inferenceResult(trail));

    expect(result.recommendations).toHaveLength(1);
    expect(result.summary.recommendationCount).toBe(1);
    expect(result.summary.averageStepConfidence).toBe(0.75);
    expect(result.summary.overallConfidence).toBe(0.82);
  });

  it('merges yaml generator reasoning into the trail when provided', () => {
    const result = explainDecision(
      analyzerResult,
      inferenceResult([{ step: 'a', inference: 'i' }]),
      { success: true, reasoning: [{ step: 'yaml_steps', inference: 'added steps' }] }
    );

    expect(result.trail).toHaveLength(2);
    expect(result.trail[1].step).toBe('yaml_steps');
  });
});
