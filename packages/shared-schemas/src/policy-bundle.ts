import { POLICY_BUNDLE_SCHEMA_VERSION } from "./versions";

export type PolicyAction = "allow" | "warn" | "redact" | "justify" | "block";

export interface PolicyRuleSelection {
  active_rule_ids: string[] | null;
  bundle_version: string;
}

export interface PolicyActionMap {
  default: PolicyAction;
  by_category: Record<string, PolicyAction>;
}

export interface PolicyBundle {
  schema_version: typeof POLICY_BUNDLE_SCHEMA_VERSION;
  policy_version: string;
  org_id: string;
  org_name: string;
  team_id?: string;
  team_name?: string;
  rules: PolicyRuleSelection;
  intent_rules: Record<string, PolicyAction>;
  actions: PolicyActionMap;
  justification_required: string[];
  strict_mode: boolean;
}
