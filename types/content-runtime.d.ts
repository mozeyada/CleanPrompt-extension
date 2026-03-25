import type { AuditEvent } from '../packages/shared-schemas/src/audit-event';
import type { PolicyBundle } from '../packages/shared-schemas/src/policy-bundle';
import type { PlatformHealthReport } from './extension-runtime';

export interface ContentRuntimeSettings {
  logclean_policy_bundle: PolicyBundle | null;
  rotating_actor_id: string;
  device_id: string;
  extension_version: string;
  policy_version: string | null;
  rules_version: string | null;
}

export interface ContentRuntimeState {
  policyBundle: PolicyBundle | null;
  orgId: string;
  orgName: string;
  teamId: string;
  teamName: string;
  rotatingActorId: string;
  deviceId: string;
  extensionVersion: string;
  policyVersion: string | null;
  rulesVersion: string | null;
  strictMode: boolean;
}

export interface RedactionFinding {
  id: string;
  label: string;
  category: string;
  risk: string;
  color?: string;
  count: number;
}

export interface ContentRedactionSummary {
  total: number;
  byCategory: Record<string, number>;
  byRisk: Record<string, number>;
}

export interface RedactionResult {
  sanitized: string;
  sanitized_text: string;
  findings: RedactionFinding[];
  tokens: Record<string, string>;
  protectionSummary: Record<string, number>;
  rule_counts: Record<string, number>;
  intent_label: string;
  intent_confidence_bucket: AuditEvent['intent_confidence_bucket'];
  policy_action: AuditEvent['action'];
  employee_explanation: string;
  safe_compose_prompt: string;
  event_summary: AuditEvent | null;
}

export interface PlatformDefinition {
  key: string;
  name: string;
  test(): boolean;
  inputSelectors: string[];
  resolveToolbar(input: Element | null): {
    element: Element | null;
    strategy: string;
  };
}

export interface SelectorCandidate {
  element: any;
  selector: string | null;
  rank: number | null;
}

declare global {
  var LOGCLEAN_RULES: any[];
  var LOGCLEAN_RISK: Record<string, { emoji: string; label: string; color: string; bg: string; border: string }>;

  function logcleanRedact(
    text: string,
    enabledIds?: string[] | null,
    options?: Record<string, unknown>
  ): Promise<RedactionResult>;
  function logcleanGetSummary(findings: RedactionFinding[]): ContentRedactionSummary;

  interface Document {
    getElementById(elementId: string): any;
    querySelector(selector: string): any;
    querySelectorAll(selectors: string): any;
    createElement(tagName: string): any;
    createTextNode(data: string): any;
    execCommand(commandId: string, showUI?: boolean, value?: string | null): boolean;
  }

  interface Element {
    closest(selectors: string): any;
    querySelector(selector: string): any;
    querySelectorAll(selectors: string): any;
    appendChild<T extends Node>(node: T): T;
  }

  interface Window {
    __logclean_injected?: boolean;
    __logclean_initialized?: boolean;
  }

  interface MutationObserver {
    observe(target: Node, options?: MutationObserverInit): void;
    disconnect(): void;
  }

  var chrome: {
    runtime: {
      sendMessage(message: any, callback?: (response: any) => void): void;
      getURL(resource: string): string;
    };
    storage: {
      local: {
        get(keys: null | string | string[] | Record<string, unknown>, callback: (items: Record<string, any>) => void): void;
      };
    };
  };

  interface Navigator {
    userAgent: string;
  }
}

export {};
