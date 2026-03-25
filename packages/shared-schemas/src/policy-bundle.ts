import { POLICY_BUNDLE_SCHEMA_VERSION } from "./versions";

export type PolicyAction = "allow" | "warn" | "redact" | "justify" | "block";

export interface PolicyRuleSelection {
  active_rule_ids: string[] | null;
  bundle_version: string;
  local_bundle_version?: string;
  total_rules?: number;
  remote_updates_enabled?: boolean;
  stage2_ner_enabled?: boolean;
  fallback_mode?: "bundled_only" | "last_known_good" | "remote_only";
}

export interface PolicyActionMap {
  default: PolicyAction;
  by_category: Record<string, PolicyAction>;
}

export interface MetadataAnalyticsSettings {
  enabled: boolean;
  raw_prompt_retention: boolean;
  user_level_drilldown: boolean;
  aggregation_thresholds?: {
    min_events: number;
    min_distinct_actors: number;
  };
  rotating_actor_window_days?: number;
}

export interface PolicyBundle {
  schema_version: typeof POLICY_BUNDLE_SCHEMA_VERSION;
  policy_version: string;
  org_id: string;
  org_name: string;
  team_id?: string;
  team_name?: string;
  app_scopes?: string[];
  rules: PolicyRuleSelection;
  intent_rules: Record<string, PolicyAction>;
  actions: PolicyActionMap;
  justification_required: string[];
  ui_copy_version?: string;
  metadata_analytics?: MetadataAnalyticsSettings;
  strict_mode: boolean;
}
