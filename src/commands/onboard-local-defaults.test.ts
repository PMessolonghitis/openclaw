import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { applyLocalOnboardingDefaults } from "./onboard-local-defaults.js";

describe("applyLocalOnboardingDefaults", () => {
  it("fills missing values for the local PMess profile", () => {
    const next = applyLocalOnboardingDefaults({});

    expect(next.gateway?.mode).toBe("local");
    expect(next.gateway?.bind).toBe("loopback");
    expect(next.gateway?.tailscale?.mode).toBe("off");

    expect(next.channels?.whatsapp?.dmPolicy).toBe("pairing");
    expect(next.channels?.whatsapp?.groupPolicy).toBe("allowlist");
    expect(next.channels?.whatsapp?.groups?.["*"]?.requireMention).toBe(true);

    expect(next.agents?.defaults?.model?.primary).toBe("openai/gpt-5.2");
    expect(next.agents?.defaults?.sandbox?.mode).toBe("off");
    expect(next.agents?.defaults?.subagents?.maxSpawnDepth).toBe(3);

    expect(next.tools?.profile).toBe("full");
    expect(next.tools?.agentToAgent?.enabled).toBe(true);
    expect(next.tools?.web?.search?.enabled).toBe(false);
    expect(next.tools?.web?.search?.provider).toBeUndefined();
    expect(next.tools?.web?.fetch?.maxChars).toBe(120000);

    expect(next.models?.providers?.deepseek?.apiKey).toBe("DEEPSEEK_API_KEY");
    expect(next.models?.providers?.["qwen-portal"]?.apiKey).toBe("QWEN_PORTAL_API_KEY");
    expect(next.models?.providers?.xai?.apiKey).toBe("XAI_API_KEY");
    expect(next.plugins?.enabled).toBe(true);
  });

  it("does not overwrite explicitly configured values", () => {
    const input: OpenClawConfig = {
      gateway: {
        mode: "local",
        bind: "lan",
        tailscale: { mode: "serve" },
      },
      channels: {
        whatsapp: {
          dmPolicy: "allowlist",
          groupPolicy: "open",
          groups: {
            team: { requireMention: false },
          },
        },
      },
      agents: {
        defaults: {
          model: {
            primary: "xai/grok-4",
            fallbacks: ["openai/gpt-5-mini"],
          },
          thinkingDefault: "low",
          timeoutSeconds: 90,
          sandbox: { mode: "all" },
          subagents: {
            maxSpawnDepth: 1,
            maxConcurrent: 1,
          },
        },
      },
      tools: {
        profile: "minimal",
        exec: { host: "sandbox", security: "allowlist", ask: "always", timeoutSec: 30 },
        web: {
          search: { enabled: false, provider: "brave" },
          fetch: { enabled: false, maxChars: 5000, maxCharsCap: 10000 },
        },
      },
      plugins: {
        enabled: false,
      },
    };

    const next = applyLocalOnboardingDefaults(input);

    expect(next.gateway?.bind).toBe("lan");
    expect(next.gateway?.tailscale?.mode).toBe("serve");

    expect(next.channels?.whatsapp?.dmPolicy).toBe("allowlist");
    expect(next.channels?.whatsapp?.groupPolicy).toBe("open");
    expect(next.channels?.whatsapp?.groups?.team?.requireMention).toBe(false);

    expect(next.agents?.defaults?.model?.primary).toBe("xai/grok-4");
    expect(next.agents?.defaults?.model?.fallbacks).toEqual(["openai/gpt-5-mini"]);
    expect(next.agents?.defaults?.thinkingDefault).toBe("low");
    expect(next.agents?.defaults?.sandbox?.mode).toBe("all");

    expect(next.tools?.profile).toBe("minimal");
    expect(next.tools?.exec?.host).toBe("sandbox");
    expect(next.tools?.exec?.security).toBe("allowlist");
    expect(next.tools?.exec?.ask).toBe("always");
    expect(next.tools?.web?.search?.enabled).toBe(false);
    expect(next.tools?.web?.search?.provider).toBe("brave");
    expect(next.tools?.web?.fetch?.enabled).toBe(false);
    expect(next.tools?.web?.fetch?.maxChars).toBe(5000);
    expect(next.plugins?.enabled).toBe(false);
  });

  it("enforces WhatsApp-only channels for local onboarding defaults", () => {
    const next = applyLocalOnboardingDefaults({
      channels: {
        whatsapp: { dmPolicy: "pairing" },
        telegram: { enabled: true, botToken: "x" },
        slack: { enabled: true, appToken: "x", token: "x" },
      },
    });

    expect(next.channels?.whatsapp?.dmPolicy).toBe("pairing");
    expect(next.channels?.telegram).toBeUndefined();
    expect(next.channels?.slack).toBeUndefined();
  });

  it("enforces the model provider allowlist for local onboarding defaults", () => {
    const next = applyLocalOnboardingDefaults({
      agents: {
        defaults: {
          models: {
            "anthropic/claude-3-7-sonnet": { alias: "claude" },
            "openai/gpt-5-mini": { alias: "gpt-mini-custom" },
          },
        },
      },
      models: {
        providers: {
          anthropic: { apiKey: "ANTHROPIC_API_KEY" },
          openai: { apiKey: "OPENAI_API_KEY" },
          google: { apiKey: "GOOGLE_API_KEY" },
        },
      },
    });

    expect(next.agents?.defaults?.model?.primary).toBe("openai/gpt-5.2");
    expect(next.agents?.defaults?.model?.fallbacks).toEqual([
      "deepseek/deepseek-chat",
      "qwen-portal/coder-model",
      "xai/grok-4",
      "google/gemini-3-pro-preview",
    ]);
    expect(next.agents?.defaults?.models?.["anthropic/claude-3-7-sonnet"]).toBeUndefined();
    expect(next.agents?.defaults?.models?.["openai/gpt-5-mini"]?.alias).toBe("gpt-mini-custom");

    expect(next.models?.providers?.anthropic).toBeUndefined();
    expect(next.models?.providers?.openai?.apiKey).toBe("OPENAI_API_KEY");
    expect(next.models?.providers?.google?.apiKey).toBe("GOOGLE_API_KEY");
    expect(next.models?.providers?.deepseek).toBeDefined();
    expect(next.models?.providers?.["qwen-portal"]).toBeDefined();
    expect(next.models?.providers?.xai).toBeDefined();
  });

  it("keeps required plugins and removes non-essential plugin entries", () => {
    const next = applyLocalOnboardingDefaults({
      plugins: {
        allow: ["telegram", "whatsapp", "memory-core"],
        deny: ["whatsapp", "legacy-plugin"],
        slots: { memory: "memory-core" },
        entries: {
          whatsapp: { enabled: true },
          "memory-core": { config: { backend: "sqlite" } },
          telegram: { enabled: true },
          "legacy-plugin": { enabled: false },
        },
      },
    });

    expect(next.plugins?.allow).toEqual(["whatsapp", "memory-core"]);
    expect(next.plugins?.deny).toEqual(["legacy-plugin"]);
    expect(next.plugins?.entries?.whatsapp).toEqual({ enabled: true });
    expect(next.plugins?.entries?.["memory-core"]).toEqual({ config: { backend: "sqlite" } });
    expect(next.plugins?.entries?.telegram).toBeUndefined();
    expect(next.plugins?.entries?.["legacy-plugin"]).toBeUndefined();
  });
});
