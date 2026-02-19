import type { OpenClawConfig } from "../config/config.js";

const DEFAULT_PRIMARY_MODEL = "openai/gpt-5.2";
const DEFAULT_FALLBACK_MODELS = [
  "deepseek/deepseek-chat",
  "qwen-portal/coder-model",
  "xai/grok-4",
  "google/gemini-3-pro-preview",
];

const DEFAULT_MODEL_ALIASES = {
  "openai/gpt-5.2": { alias: "gpt" },
  "openai/gpt-5-mini": { alias: "gpt-mini" },
  "deepseek/deepseek-chat": { alias: "deepseek" },
  "deepseek/deepseek-reasoner": { alias: "deepseek-r1" },
  "qwen-portal/coder-model": { alias: "qwen-coder" },
  "qwen-portal/vision-model": { alias: "qwen-vision" },
  "xai/grok-4": { alias: "grok" },
  "google/gemini-3-pro-preview": { alias: "gemini" },
  "google/gemini-3-flash-preview": { alias: "gemini-flash" },
};

const DEFAULT_CUSTOM_PROVIDERS = {
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1",
    apiKey: "DEEPSEEK_API_KEY",
    api: "openai-completions",
    models: [
      {
        id: "deepseek-chat",
        name: "DeepSeek Chat",
        reasoning: true,
        input: ["text"],
      },
      {
        id: "deepseek-reasoner",
        name: "DeepSeek Reasoner",
        reasoning: true,
        input: ["text"],
      },
    ],
  },
  "qwen-portal": {
    baseUrl: "https://portal.qwen.ai/v1",
    apiKey: "QWEN_PORTAL_API_KEY",
    api: "openai-completions",
    models: [
      {
        id: "coder-model",
        name: "Qwen Coder",
        reasoning: false,
        input: ["text"],
      },
      {
        id: "vision-model",
        name: "Qwen Vision",
        reasoning: false,
        input: ["text", "image"],
      },
    ],
  },
  xai: {
    baseUrl: "https://api.x.ai/v1",
    apiKey: "XAI_API_KEY",
    api: "openai-completions",
    models: [
      {
        id: "grok-4",
        name: "Grok 4",
        reasoning: false,
        input: ["text"],
      },
    ],
  },
} as const;

export function applyLocalOnboardingDefaults(cfg: OpenClawConfig): OpenClawConfig {
  const whatsapp = {
    ...cfg.channels?.whatsapp,
    dmPolicy: cfg.channels?.whatsapp?.dmPolicy ?? "pairing",
    groupPolicy: cfg.channels?.whatsapp?.groupPolicy ?? "allowlist",
    groups: cfg.channels?.whatsapp?.groups ?? {
      "*": { requireMention: true },
    },
  };

  return {
    ...cfg,
    gateway: {
      ...cfg.gateway,
      mode: cfg.gateway?.mode ?? "local",
      bind: cfg.gateway?.bind ?? "loopback",
      tailscale: {
        ...cfg.gateway?.tailscale,
        mode: cfg.gateway?.tailscale?.mode ?? "off",
      },
    },
    channels: {
      whatsapp,
    },
    agents: {
      ...cfg.agents,
      defaults: {
        ...cfg.agents?.defaults,
        model: {
          ...cfg.agents?.defaults?.model,
          primary: cfg.agents?.defaults?.model?.primary ?? DEFAULT_PRIMARY_MODEL,
          fallbacks: cfg.agents?.defaults?.model?.fallbacks ?? [...DEFAULT_FALLBACK_MODELS],
        },
        models: {
          ...DEFAULT_MODEL_ALIASES,
          ...cfg.agents?.defaults?.models,
        },
        thinkingDefault: cfg.agents?.defaults?.thinkingDefault ?? "high",
        timeoutSeconds: cfg.agents?.defaults?.timeoutSeconds ?? 1800,
        sandbox: {
          ...cfg.agents?.defaults?.sandbox,
          mode: cfg.agents?.defaults?.sandbox?.mode ?? "off",
        },
        subagents: {
          ...cfg.agents?.defaults?.subagents,
          maxSpawnDepth: cfg.agents?.defaults?.subagents?.maxSpawnDepth ?? 3,
          maxConcurrent: cfg.agents?.defaults?.subagents?.maxConcurrent ?? 4,
        },
      },
    },
    models: {
      ...cfg.models,
      providers: {
        ...DEFAULT_CUSTOM_PROVIDERS,
        ...cfg.models?.providers,
      },
    },
    tools: {
      ...cfg.tools,
      profile: cfg.tools?.profile ?? "full",
      agentToAgent: {
        ...cfg.tools?.agentToAgent,
        enabled: cfg.tools?.agentToAgent?.enabled ?? true,
      },
      loopDetection: {
        ...cfg.tools?.loopDetection,
        enabled: cfg.tools?.loopDetection?.enabled ?? true,
      },
      exec: {
        ...cfg.tools?.exec,
        host: cfg.tools?.exec?.host ?? "gateway",
        security: cfg.tools?.exec?.security ?? "full",
        ask: cfg.tools?.exec?.ask ?? "off",
        timeoutSec: cfg.tools?.exec?.timeoutSec ?? 3600,
      },
      web: {
        ...cfg.tools?.web,
        search: {
          ...cfg.tools?.web?.search,
          enabled: cfg.tools?.web?.search?.enabled ?? true,
          provider: cfg.tools?.web?.search?.provider ?? "grok",
          grok: {
            ...cfg.tools?.web?.search?.grok,
            model: cfg.tools?.web?.search?.grok?.model ?? "grok-4-1-fast",
            inlineCitations: cfg.tools?.web?.search?.grok?.inlineCitations ?? true,
          },
        },
        fetch: {
          ...cfg.tools?.web?.fetch,
          enabled: cfg.tools?.web?.fetch?.enabled ?? true,
          maxChars: cfg.tools?.web?.fetch?.maxChars ?? 120000,
          maxCharsCap: cfg.tools?.web?.fetch?.maxCharsCap ?? 120000,
        },
      },
    },
    plugins: {
      ...cfg.plugins,
      enabled: cfg.plugins?.enabled ?? true,
    },
  };
}
