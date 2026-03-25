import type { AuditEvent } from '../../packages/shared-schemas/src/audit-event';
import type { PolicyBundle } from '../../packages/shared-schemas/src/policy-bundle';
import type {
  DeviceEnrollmentRequest,
  DeviceEnrollmentResponse,
} from '../../packages/shared-schemas/src/device-enrollment';

export interface ControlPlaneConfig {
  port: number;
  host: string;
  environment: string;
  orgId: string;
  orgName: string;
  teamId: string;
  teamName: string;
  policyVersion: string;
  rulesVersion: string;
  dataDir: string;
  dataFile: string;
}

export interface PersistedAuditEvent {
  received_at: string;
  event: AuditEvent;
}

export interface DeviceRecord extends DeviceEnrollmentResponse {
  extension_version: string;
  browser_family: DeviceEnrollmentRequest['browser_family'];
  os_family: DeviceEnrollmentRequest['os_family'];
  managed_device: boolean;
  enrolled_at: string;
}

export interface AdminAction {
  ts: string;
  action_type: string;
  actor: string;
  policy_version: string | null;
  rules_version: string | null;
  metadata_only: boolean;
  details: Record<string, unknown>;
}

export interface ControlPlaneState {
  policyBundle: PolicyBundle;
  auditEvents: PersistedAuditEvent[];
  devices: DeviceRecord[];
  adminActions: AdminAction[];
}

export interface AdminSummary {
  generated_at: string;
  org_id: string | null;
  org_name: string | null;
  policy_version: string | null;
  rules_version: string | null;
  device_count: number;
  audit_event_count: number;
  action_counts: Record<string, number>;
  category_counts: Record<string, number>;
  intent_counts: Record<string, number>;
  device_version_counts: Record<string, number>;
  browser_counts: Record<string, number>;
  latest_event_at: string | null;
  latest_enrollment_at: string | null;
  metadata_only: true;
  raw_prompt_retention: false;
}
