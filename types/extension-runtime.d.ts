import type { AuditEvent } from '../packages/shared-schemas/src/audit-event';
import type { DeviceEnrollmentRequest } from '../packages/shared-schemas/src/device-enrollment';
import type { PolicyBundle } from '../packages/shared-schemas/src/policy-bundle';

export interface SharedSchemaRuntime {
  validatePolicyBundle(input: unknown): string | null;
  validateAuditEvent(input: unknown): string | null;
  validateDeviceEnrollmentRequest(input: unknown): string | null;
}

export interface EnrollmentRecord {
  schema_version: string;
  device_id: string;
  org_id: string | null;
  policy_version: string | null;
  rules_version: string | null;
  enrolled_at: string;
}

export interface StatusResult {
  status: string;
  ts: string;
  endpoint?: string;
  code?: number;
  message?: string;
  reason?: string;
  step?: string;
  device_id?: string | null;
  policy_version?: string | null;
  action?: AuditEvent['action'];
  site?: string;
  validation_error?: string;
  enrollment_reason?: string;
}

export interface PlatformHealthReport {
  host: string;
  platform_key: string;
  platform_name: string;
  input_detected: boolean;
  toolbar_detected: boolean;
  send_button_detected: boolean;
  trigger_attached: boolean;
  sidebar_ready: boolean;
  detection_reason: string;
  input_selector: string | null;
  input_selector_rank: number | null;
  toolbar_strategy: string | null;
  send_selector: string | null;
  send_selector_rank: number | null;
  attachment_container_tag: string | null;
  compatibility_confidence: string;
  ts: string;
}

export interface LocalAuditLogEntry {
  ts: string;
  url: string;
  redacted_count: number;
  categories: string[];
  risk_summary: Record<string, number>;
  action: AuditEvent['action'];
  intent_label: string;
}

export interface LocalDeviceEventEntry {
  ts: string;
  org_id: string;
  org_name: string;
  team_id: string;
  team_name: string;
  site: string;
  action: AuditEvent['action'];
  intent_label: string;
  intent_confidence_bucket: AuditEvent['intent_confidence_bucket'];
  sensitivity_categories: string[];
  rule_ids: string[];
  count_summary: AuditEvent['count_summary'];
  prompt_size_bucket: AuditEvent['prompt_size_bucket'];
  rotating_actor_id: string;
  strict_mode: boolean;
  raw_text_absent: boolean;
  justification_provided: boolean;
}

export interface TrainingSignal {
  ts: string;
  type: string;
  intent_label: string;
  categories: string[];
}

export interface LocalSettings {
  logclean_enabled: boolean;
  logclean_intercept_enabled: boolean;
  logclean_plan: string;
  logclean_rules_version: string;
  logclean_rules_override: unknown[] | null;
  logclean_audit_log: LocalAuditLogEntry[];
  logclean_device_events: LocalDeviceEventEntry[];
  logclean_training_signals: TrainingSignal[];
  logclean_actor_seed: string;
  logclean_device_id: string;
  logclean_policy_sync_enabled: boolean;
  logclean_control_plane_base_url: string;
  logclean_enrollment_token: string;
  logclean_device_enrollment: EnrollmentRecord | null;
  logclean_last_enrollment_result: StatusResult | null;
  logclean_last_sync_result: StatusResult | null;
  logclean_last_audit_upload_result: StatusResult | null;
  logclean_platform_health: Record<string, PlatformHealthReport>;
  logclean_policy_bundle: PolicyBundle;
  logclean_active_rules?: string[] | null;
}

export interface UploadDecisionBlocked {
  allowed: false;
  reason: string;
}

export interface UploadDecisionAllowed {
  allowed: true;
  policy: PolicyBundle;
}

export type UploadDecision = UploadDecisionBlocked | UploadDecisionAllowed;

declare global {
  var CLEANPROMPT_SHARED_SCHEMAS: SharedSchemaRuntime | undefined;

  function importScripts(...urls: string[]): void;

  interface ChromeStorageArea {
    get(
      keys: null | string | string[] | Record<string, unknown>,
      callback: (items: Record<string, any>) => void
    ): void;
    set(items: object, callback?: () => void): void;
  }

  interface ChromeEvent<TCallback extends (...args: any[]) => any> {
    addListener(callback: TCallback): void;
  }

  var chrome: {
    runtime: {
      getManifest(): { version: string };
      getURL(resource: string): string;
      sendMessage(message: any, callback?: (response?: any) => void): void;
      lastError?: { message: string } | null;
      onInstalled: ChromeEvent<(details: { reason?: string }) => void>;
      onStartup: ChromeEvent<() => void>;
      onMessage: ChromeEvent<
        (
          message: any,
          sender: unknown,
          sendResponse: (response?: any) => void
        ) => boolean | void
      >;
    };
    alarms: {
      create(name: string, info: { delayInMinutes?: number; periodInMinutes?: number }): void;
      onAlarm: ChromeEvent<(alarm: { name?: string } | null | undefined) => void>;
    };
    storage: {
      local: ChromeStorageArea;
    };
    tabs: {
      create(createProperties: { url: string }): void;
    };
  };
}

export {};
