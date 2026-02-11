/**
 * Orchestrator Agent
 * Runs the marketing pipeline in sequence
 */

import * as path from 'path';
import { spawn } from 'child_process';
import {
  loadAgentConfig,
  isStopAll,
  isPublishEnabled,
  today,
  ensureDir,
  writeFile,
  startHealthServer,
  generateTraceId,
  sleep,
} from '../../shared/agent/utils.js';
import { logAgentAction, logError } from '../../shared/moltbook/ledger.js';

const AGENT_NAME = 'orchestrator';

// Pipeline stages in order
const PIPELINE_STAGES = [
  { name: 'strategy', description: 'Generate daily brief' },
  { name: 'content', description: 'Generate content drafts' },
  { name: 'distribution', description: 'Publish approved content' },
  { name: 'community', description: 'Monitor community interactions' },
  { name: 'partnerships', description: 'Generate partnership leads' },
  { name: 'analytics', description: 'Generate analytics report' },
  { name: 'proof', description: 'Generate proof pack' },
];

interface StageResult {
  stage: string;
  success: boolean;
  duration: number;
  error?: string;
  output?: string;
}

interface PipelineResult {
  traceId: string;
  date: string;
  startedAt: string;
  completedAt: string;
  totalDuration: number;
  stages: StageResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

/**
 * Run a single agent stage
 */
async function runStage(
  stageName: string,
  workspaceDir: string,
  moltbookDir: string,
  configDir: string,
  storeDb: string,
  dryRun: boolean
): Promise<StageResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    // Use tsx for TypeScript, fall back to node for JS
    const agentPathTs = path.join(__dirname, '..', stageName, 'index.ts');
    const agentPathJs = path.join(__dirname, '..', stageName, 'index.js');
    
    // Determine which runner to use
    const useTs = require('fs').existsSync(agentPathTs);
    const agentPath = useTs ? agentPathTs : agentPathJs;
    const runner = useTs ? 'npx' : 'node';
    const args = useTs ? ['tsx', agentPath] : [agentPath];

    const env = {
      ...process.env,
      RUN_ONCE: 'true',
      WORKSPACE_DIR: workspaceDir,
      MOLTBOOK_DIR: moltbookDir,
      CONFIG_DIR: configDir,
      STORE_DB: storeDb,
      DRY_RUN: String(dryRun),
    };

    const child = spawn(runner, args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      const duration = Date.now() - startTime;

      if (code === 0) {
        resolve({
          stage: stageName,
          success: true,
          duration,
          output: stdout.trim(),
        });
      } else {
        resolve({
          stage: stageName,
          success: false,
          duration,
          error: stderr.trim() || `Exit code ${code}`,
          output: stdout.trim(),
        });
      }
    });

    child.on('error', (err) => {
      resolve({
        stage: stageName,
        success: false,
        duration: Date.now() - startTime,
        error: err.message,
      });
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      child.kill('SIGTERM');
      resolve({
        stage: stageName,
        success: false,
        duration: Date.now() - startTime,
        error: 'Timeout after 5 minutes',
      });
    }, 5 * 60 * 1000);
  });
}

/**
 * Run the full pipeline
 */
async function runPipeline(config: ReturnType<typeof loadAgentConfig>): Promise<PipelineResult> {
  const traceId = generateTraceId();
  const date = today();
  const startedAt = new Date().toISOString();
  const stages: StageResult[] = [];

  console.log(`[${AGENT_NAME}] Starting pipeline - trace: ${traceId}`);

  // Log pipeline start
  await logAgentAction(config.moltbookDir, {
    sourceAgent: AGENT_NAME,
    platform: 'internal',
    actionType: 'pipeline',
    fingerprint: `pipeline-start-${date}`,
    traceId,
    status: 'started',
    summary: `Pipeline started for ${date}`,
    data: { stages: PIPELINE_STAGES.map(s => s.name) },
  });

  for (const stage of PIPELINE_STAGES) {
    console.log(`[${AGENT_NAME}] Running stage: ${stage.name} - ${stage.description}`);

    // Check kill switch before each stage
    if (isStopAll(config.configDir)) {
      console.log(`[${AGENT_NAME}] STOP_ALL detected, aborting pipeline`);
      break;
    }

    const result = await runStage(
      stage.name,
      config.workspaceDir,
      config.moltbookDir,
      config.configDir,
      config.storeDb,
      config.dryRun
    );

    stages.push(result);

    if (result.success) {
      console.log(`[${AGENT_NAME}] ✓ ${stage.name} completed (${result.duration}ms)`);
    } else {
      console.log(`[${AGENT_NAME}] ✗ ${stage.name} failed: ${result.error}`);
      // Continue with other stages even if one fails
    }

    // Small delay between stages
    await sleep(1000);
  }

  const completedAt = new Date().toISOString();
  const totalDuration = Date.now() - new Date(startedAt).getTime();

  const pipelineResult: PipelineResult = {
    traceId,
    date,
    startedAt,
    completedAt,
    totalDuration,
    stages,
    summary: {
      total: stages.length,
      passed: stages.filter(s => s.success).length,
      failed: stages.filter(s => !s.success).length,
    },
  };

  // Log pipeline completion
  await logAgentAction(config.moltbookDir, {
    sourceAgent: AGENT_NAME,
    platform: 'internal',
    actionType: 'pipeline',
    fingerprint: `pipeline-complete-${date}`,
    traceId,
    status: pipelineResult.summary.failed === 0 ? 'success' : 'partial',
    summary: `Pipeline completed: ${pipelineResult.summary.passed}/${pipelineResult.summary.total} stages passed`,
    data: {
      totalDuration,
      passed: pipelineResult.summary.passed,
      failed: pipelineResult.summary.failed,
    },
  });

  return pipelineResult;
}

/**
 * Format pipeline result as markdown
 */
function formatPipelineReport(result: PipelineResult): string {
  return `# Pipeline Execution Report

## Summary
- **Trace ID:** ${result.traceId}
- **Date:** ${result.date}
- **Started:** ${result.startedAt}
- **Completed:** ${result.completedAt}
- **Total Duration:** ${Math.round(result.totalDuration / 1000)}s
- **Status:** ${result.summary.failed === 0 ? '✅ All Passed' : '⚠️ Partial'}

## Results

| Stage | Status | Duration | Notes |
|-------|--------|----------|-------|
${result.stages.map(s =>
  `| ${s.stage} | ${s.success ? '✅' : '❌'} | ${s.duration}ms | ${s.error || 'OK'} |`
).join('\n')}

## Summary
- **Total Stages:** ${result.summary.total}
- **Passed:** ${result.summary.passed}
- **Failed:** ${result.summary.failed}

---
Generated by ${AGENT_NAME} at ${result.completedAt}
`;
}

async function run(): Promise<void> {
  const config = loadAgentConfig(AGENT_NAME);

  console.log(`[${AGENT_NAME}] Starting...`);
  console.log(`[${AGENT_NAME}] DRY_RUN: ${config.dryRun}`);
  console.log(`[${AGENT_NAME}] PUBLISH_ENABLED: ${isPublishEnabled()}`);

  if (isStopAll(config.configDir)) {
    console.log(`[${AGENT_NAME}] STOP_ALL active, exiting`);
    process.exit(0);
  }

  try {
    const result = await runPipeline(config);

    // Write report
    const reportsDir = path.join(config.workspaceDir, 'orchestrator', 'reports');
    ensureDir(reportsDir);

    const reportPath = path.join(reportsDir, `${result.traceId}.md`);
    const jsonPath = path.join(reportsDir, `${result.traceId}.json`);

    writeFile(reportPath, formatPipelineReport(result));
    writeFile(jsonPath, JSON.stringify(result, null, 2));

    console.log(`[${AGENT_NAME}] Pipeline complete: ${result.summary.passed}/${result.summary.total} passed`);
    console.log(`[${AGENT_NAME}] Report: ${reportPath}`);

    // Exit with error if any stage failed
    if (result.summary.failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[${AGENT_NAME}] Fatal error:`, error);

    await logError(config.moltbookDir, {
      sourceAgent: AGENT_NAME,
      platform: 'internal',
      fingerprint: `error-${Date.now()}`,
      traceId: generateTraceId(),
      status: 'error',
      summary: `Orchestrator fatal error: ${error}`,
      data: { error },
    });

    process.exit(1);
  }
}

// Main
const config = loadAgentConfig(AGENT_NAME);

if (config.runOnce) {
  run();
} else {
  // In daemon mode, start health server but don't auto-run
  // Pipeline runs are triggered by external scheduler (systemd/cron)
  startHealthServer(3000, AGENT_NAME);
  console.log(`[${AGENT_NAME}] Daemon mode - waiting for triggers`);
}
