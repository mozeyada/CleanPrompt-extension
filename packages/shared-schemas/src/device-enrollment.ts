import { DEVICE_ENROLLMENT_SCHEMA_VERSION } from "./versions";

export interface DeviceEnrollmentRequest {
  schema_version: typeof DEVICE_ENROLLMENT_SCHEMA_VERSION;
  enrollment_token: string;
  extension_version: string;
  browser_family: "chrome" | "edge" | "other";
  os_family: "windows" | "macos" | "linux" | "other";
  managed_device: boolean;
}

export interface DeviceEnrollmentResponse {
  schema_version: typeof DEVICE_ENROLLMENT_SCHEMA_VERSION;
  device_id: string;
  org_id: string;
  policy_version: string;
  rules_version: string;
}
