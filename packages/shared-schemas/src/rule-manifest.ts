import { RULE_MANIFEST_SCHEMA_VERSION } from "./versions";

export interface RuleManifestItem {
  id: string;
  label: string;
  category: string;
  risk: "critical" | "high" | "medium" | "low";
  color: string;
  pattern: string;
  flags?: string;
}

export interface RuleManifest {
  schema_version: typeof RULE_MANIFEST_SCHEMA_VERSION;
  manifest_version: string;
  published_at: string;
  compatible_extension_versions: string[];
  rules: RuleManifestItem[];
  signature: string;
}
