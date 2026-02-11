/**
 * Base platform connector with policy + Moltbook wiring
 */

import { evaluate, generateFingerprint as policyFingerprint } from '../policy/policy.js';
import { createInMemoryStore } from '../store/sqlite.js';
import type { PlatformAction as PolicyAction, Platform as PolicyPlatform, ActionType as PolicyActionType } from '../policy/types.js';
import {
  logPolicyDecision,
  logPlatformAttempt,
  logPlatformResult,
  logError,
} from '../moltbook/ledger.js';
import type { Platform, PlatformAction, PlatformResult, ConnectorConfig } from './types.js';

export interface ExecuteFn {
  (action: PlatformAction, config: ConnectorConfig): Promise<PlatformResult>;
}

/**
 * Wraps a platform-specific execute function with policy + Moltbook
 */
export async function executeWithPolicy(
  action: PlatformAction,
  config: ConnectorConfig,
  executeFn: ExecuteFn
): Promise<PlatformResult> {
  const { moltbookDir, storeDb, dryRun } = config;
  const sourceAgent = `distribution:${action.platform}`;

  // 1. Build policy request
  const links = extractLinks(action.content);
  const policyAction: PolicyAction = {
    platform: action.platform as PolicyPlatform,
    action_type: action.actionType as PolicyActionType,
    text: action.content,
    links,
    metadata: {},
    time: new Date(),
  };

  // 2. Evaluate policy using in-memory store
  const store = createInMemoryStore();
  const decision = evaluate(policyAction, undefined, store);

  // 3. Log policy decision to Moltbook
  await logPolicyDecision(moltbookDir, {
    sourceAgent,
    platform: action.platform,
    fingerprint: action.fingerprint,
    traceId: action.traceId,
    status: decision.allow ? 'allowed' : 'blocked',
    summary: decision.allow
      ? `Policy allowed: risk=${decision.risk_score}`
      : `Policy blocked: ${decision.reason_codes.join(', ')}`,
    data: {
      riskScore: decision.risk_score,
      violations: decision.reason_codes,
      warnings: [],
    },
  });

  // 4. If blocked, return early
  if (!decision.allow) {
    return {
      success: false,
      platform: action.platform,
      actionType: action.actionType,
      error: `Policy blocked: ${decision.reason_codes.join(', ')}`,
      retryable: false,
      timestamp: new Date().toISOString(),
    };
  }

  // 5. Log platform attempt
  await logPlatformAttempt(moltbookDir, {
    sourceAgent,
    platform: action.platform,
    actionType: action.actionType,
    fingerprint: action.fingerprint,
    traceId: action.traceId,
    summary: `Attempting ${action.actionType} on ${action.platform}`,
    data: {
      contentLength: action.content.length,
      title: action.title,
      dryRun,
    },
  });

  // 6. Execute (or simulate in dry run)
  let result: PlatformResult;
  try {
    if (dryRun) {
      result = {
        success: true,
        platform: action.platform,
        actionType: action.actionType,
        postId: `dry-run-${Date.now()}`,
        postUrl: `https://${action.platform}.example/dry-run`,
        retryable: false,
        timestamp: new Date().toISOString(),
      };
    } else {
      result = await executeFn(action, config);
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    result = {
      success: false,
      platform: action.platform,
      actionType: action.actionType,
      error,
      retryable: isRetryableError(error),
      timestamp: new Date().toISOString(),
    };

    // Log error
    await logError(moltbookDir, {
      sourceAgent,
      platform: action.platform,
      fingerprint: action.fingerprint,
      traceId: action.traceId,
      status: 'error',
      summary: `Platform error: ${error}`,
      data: { error, retryable: result.retryable },
    });
  }

  // 7. Log platform result
  await logPlatformResult(moltbookDir, {
    sourceAgent,
    platform: action.platform,
    actionType: action.actionType,
    fingerprint: action.fingerprint,
    traceId: action.traceId,
    status: result.success ? 'success' : 'failed',
    summary: result.success
      ? `Posted successfully: ${result.postUrl}`
      : `Failed: ${result.error}`,
    data: {
      postId: result.postId,
      postUrl: result.postUrl,
      error: result.error,
      retryable: result.retryable,
    },
    links: result.postUrl ? [result.postUrl] : undefined,
  });

  return result;
}

/**
 * Check if circuit breaker is tripped
 * For now, uses file-based circuit breaker (can be enhanced with SQLite)
 */
export async function isCircuitOpen(storeDb: string, platform: Platform): Promise<boolean> {
  // Simple file-based check - could be enhanced
  try {
    const fs = await import('fs');
    const path = await import('path');
    const circuitFile = path.join(path.dirname(storeDb), `circuit_${platform}.lock`);
    
    if (fs.existsSync(circuitFile)) {
      const content = fs.readFileSync(circuitFile, 'utf-8');
      const disabledUntil = parseInt(content, 10);
      if (Date.now() < disabledUntil) {
        return true; // Circuit is open (platform disabled)
      }
      // Circuit expired, remove file
      fs.unlinkSync(circuitFile);
    }
  } catch {
    // Ignore errors, assume circuit is closed
  }
  return false;
}

/**
 * Extract URLs from content
 */
function extractLinks(content: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  return content.match(urlRegex) || [];
}

/**
 * Extract @mentions from content
 */
function extractMentions(content: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const matches = content.match(mentionRegex) || [];
  return matches.map(m => m.substring(1)); // Remove @ prefix
}

/**
 * Count @mentions in content
 */
function countMentions(content: string): number {
  const mentionRegex = /@\w+/g;
  return (content.match(mentionRegex) || []).length;
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: string): boolean {
  const retryablePatterns = [
    /rate.?limit/i,
    /timeout/i,
    /network/i,
    /connection/i,
    /502|503|504/,
    /temporarily/i,
  ];
  return retryablePatterns.some(p => p.test(error));
}
