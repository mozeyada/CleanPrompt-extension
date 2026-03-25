import type { AuditEvent } from '../../packages/shared-schemas/src/audit-event';
import type { DeviceEnrollmentRequest } from '../../packages/shared-schemas/src/device-enrollment';
import type { PolicyBundle } from '../../packages/shared-schemas/src/policy-bundle';
import type { RolloutState } from '../../packages/shared-schemas/src/rollout-state';
import type { RuleManifest } from '../../packages/shared-schemas/src/rule-manifest';

export const PROHIBITED_AUDIT_FIELDS: string[];
export const VALID_ACTIONS: string[];
export const VALID_ARTIFACT_TYPES: string[];
export const VALID_BROWSER_FAMILIES: string[];
export const VALID_CONFIDENCE_BUCKETS: string[];
export const VALID_OS_FAMILIES: string[];
export const VALID_PROMPT_SIZE_BUCKETS: string[];
export const VALID_ROLLOUT_STAGES: string[];
export const VALID_RULE_FALLBACK_MODES: string[];
export const VALID_RULE_RISKS: string[];

export function validateAuditEvent(input: unknown): string | null;
export function validateDeviceEnrollmentRequest(input: unknown): string | null;
export function validatePolicyBundle(input: unknown): string | null;
export function validateRolloutState(input: unknown): string | null;
export function validateRuleManifest(input: unknown): string | null;
