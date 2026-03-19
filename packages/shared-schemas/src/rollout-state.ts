import { ROLLOUT_STATE_SCHEMA_VERSION } from "./versions";

export interface RolloutState {
  schema_version: typeof ROLLOUT_STATE_SCHEMA_VERSION;
  artifact_type: "policy_bundle" | "rule_manifest";
  artifact_version: string;
  rollout_stage: "draft" | "canary" | "partial" | "full" | "rollback";
  rollout_percentage: number;
  emergency_blocked: boolean;
}
