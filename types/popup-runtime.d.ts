import type { PolicyBundle } from '../packages/shared-schemas/src/policy-bundle';
import type { LocalSettings, PlatformHealthReport, StatusResult } from './extension-runtime';
import type { RedactionResult } from './content-runtime';

export interface PopupManagedSettings extends Partial<LocalSettings> {
  device_id?: string;
  extension_version?: string;
  policy_version?: string | null;
  rules_version?: string | null;
  logclean_platform_health?: Record<string, PlatformHealthReport>;
}

export interface PopupManagedViewModel {
  syncEnabled: boolean;
  baseUrl: string;
  orgName: string;
  deviceId: string;
  extensionVersion: string;
  policyVersion: string;
  rulesVersion: string;
  modeLabel: string;
  modeTone: string;
  enrollmentLabel: string;
  enrollmentTone: string;
  syncLabel: string;
  syncTone: string;
  enrollmentDetail: string;
  syncDetail: string;
  uploadDetail: string;
  uploadLabel: string;
  uploadTone: string;
  insightSummary: string;
  demoNextStep: string;
  demoResetNote: string;
  demoFlowNote: string;
}

export interface PopupPlatformCoverageItem {
  icon: string;
  name: string;
  host: string;
  url: string;
  statusLabel: string;
  statusTone: string;
  detail: string;
}

export interface PopupRedactionSummary {
  total: number;
  byCategory: Record<string, number>;
  byProtection: Record<string, number>;
  byRisk: Record<string, number>;
}

export interface PopupRuleListItem {
  id: string;
  label: string;
  category: string;
  risk: string;
  color: string;
}

export interface PopupProtectionLevel {
  emoji: string;
  label: string;
  color: string;
  bg: string;
  border: string;
}

declare global {
  var LOGCLEAN_RULES: PopupRuleListItem[];
  var LOGCLEAN_PROTECTION: Record<string, PopupProtectionLevel>;

  function logcleanRedact(
    text: string,
    enabledIds?: string[] | null,
    options?: Record<string, unknown>
  ): Promise<RedactionResult>;
  function logcleanGetSummary(findings: any[]): PopupRedactionSummary;

  interface ChromeRuntimeError {
    message: string;
  }

  interface Document {
    getElementById(elementId: string): any;
    querySelector(selector: string): any;
    querySelectorAll(selectors: string): any;
    createElement(tagName: string): any;
    createTextNode(data: string): any;
  }

  interface NavigatorClipboard {
    writeText(data: string): Promise<void>;
  }

  interface Navigator {
    clipboard: NavigatorClipboard;
  }

  var chrome: {
    runtime: {
      getManifest(): { version: string };
      getURL(resource: string): string;
      sendMessage(message: any, callback?: (response?: any) => void): void;
      lastError?: ChromeRuntimeError | null;
    };
    tabs: {
      create(createProperties: { url: string }): void;
    };
    storage: {
      local: {
        get(keys: null | string | string[] | Record<string, unknown>, callback: (items: Record<string, any>) => void): void;
        set(items: object, callback?: () => void): void;
      };
    };
  };
}

export {};
