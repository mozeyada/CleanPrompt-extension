import { AUDIT_EVENT_SCHEMA_VERSION } from "./versions";

export interface AuditCountSummary {
  total: number;
  by_category: Record<string, number>;
  by_risk: Record<string, number>;
}

export interface AuditEvent {
  schema_version: typeof AUDIT_EVENT_SCHEMA_VERSION;
  org_id: string;
  org_name?: string;
  team_id?: string;
  team_name?: string;
  user_id?: string;
  device_id: string;
  extension_version: string;
  policy_version?: string;
  rules_version?: string;
  site: string;
  action: "allow" | "warn" | "redact" | "justify" | "block";
  intent_label: string;
  intent_confidence_bucket: "low" | "medium" | "high";
  sensitivity_categories: string[];
  rule_ids: string[];
  count_summary: AuditCountSummary;
  prompt_size_bucket: "small" | "medium" | "large";
  timestamp_bucket: string;
  raw_text_absent: true;
  rotating_actor_id?: string;
  strict_mode?: boolean;
  justification_required?: boolean;
  justification_provided?: boolean;
}
