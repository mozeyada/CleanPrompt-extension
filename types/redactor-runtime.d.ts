import type { AuditEvent } from '../packages/shared-schemas/src/audit-event';
import type { PolicyBundle } from '../packages/shared-schemas/src/policy-bundle';

export interface RedactionRule {
  id: string;
  label: string;
  category: string;
  risk: 'critical' | 'high' | 'medium' | 'low';
  color: string;
  pattern: RegExp;
}

export interface RedactionFinding {
  id: string;
  label: string;
  category: string;
  risk: 'critical' | 'high' | 'medium' | 'low';
  color?: string;
  count: number;
}

export interface IntentClassification {
  intent_label: string;
  intent_confidence_bucket: AuditEvent['intent_confidence_bucket'];
}

export interface RedactionSummary {
  total: number;
  byCategory: Record<string, number>;
  byProtection: Record<string, number>;
  byRisk: Record<string, number>;
}

export interface RedactionContext {
  schema_version?: string;
  org_id?: string;
  org_name?: string;
  team_id?: string;
  team_name?: string;
  device_id?: string;
  extension_version?: string;
  policy_version?: string | null;
  rules_version?: string | null;
  site?: string;
  action?: AuditEvent['action'];
  policy_bundle?: PolicyBundle | null;
  rotating_actor_id?: string;
  strict_mode?: boolean;
  justification_provided?: boolean;
}

export interface RedactionResult {
  sanitized: string;
  sanitized_text: string;
  findings: RedactionFinding[];
  tokens: Record<string, string>;
  protectionSummary: Record<string, number>;
  rule_counts: Record<string, number>;
  intent_label: string;
  intent_confidence_bucket: AuditEvent['intent_confidence_bucket'];
  policy_action: AuditEvent['action'];
  employee_explanation: string;
  safe_compose_prompt: string;
  event_summary: AuditEvent | null;
}

declare global {
  interface Window {
    [key: string]: unknown;
  }

  var chrome: {
    runtime: {
      getURL(resource: string): string;
    };
  };
}

export {};
