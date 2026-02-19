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

const ALLOWED_PROVIDER_IDS = new Set([
  "openai",
  "deepseek",
  "qwen-portal",
  "qwen",
  "xai",
  "grok",
  "google",
  "gemini",
]);

function normalizeProviderId(providerId: string): string {
  return providerId.trim().toLowerCase();
}

function resolveProviderIdFromModelRef(modelRef: string): string | null {
  const slashIndex = modelRef.indexOf("/");
  if (slashIndex <= 0) {
    return null;
  }
  return normalizeProviderId(modelRef.slice(0, slashIndex));
}

function isAllowedModelRef(modelRef: string): boolean {
  const providerId = resolveProviderIdFromModelRef(modelRef);
  return providerId !== null && ALLOWED_PROVIDER_IDS.has(providerId);
}

export function applyLocalOnboardingDefaults(cfg: OpenClawConfig): OpenClawConfig {
  const hasAuthProfiles = Object.keys(cfg.auth?.profiles ?? {}).length > 0;
  const hasPrimaryModel =
    typeof cfg.agents?.defaults?.model?.primary === "string" &&
    cfg.agents?.defaults?.model?.primary.trim().length > 0;
  const enforceProviderAllowlist = !hasAuthProfiles && !hasPrimaryModel;

  const whatsapp = {
    ...cfg.channels?.whatsapp,
    dmPolicy: cfg.channels?.whatsapp?.dmPolicy ?? "pairing",
    groupPolicy: cfg.channels?.whatsapp?.groupPolicy ?? "allowlist",
    groups: cfg.channels?.whatsapp?.groups ?? {
      "*": { requireMention: true },
    },
  };

  const configuredPrimaryModel = cfg.agents?.defaults?.model?.primary;
  const primaryModel =
    typeof configuredPrimaryModel !== "string"
      ? DEFAULT_PRIMARY_MODEL
      : !enforceProviderAllowlist || isAllowedModelRef(configuredPrimaryModel)
        ? configuredPrimaryModel
        : DEFAULT_PRIMARY_MODEL;

  const configuredFallbacks = cfg.agents?.defaults?.model?.fallbacks;
  const fallbackCandidates = Array.isArray(configuredFallbacks)
    ? configuredFallbacks
    : [...DEFAULT_FALLBACK_MODELS];
  const allowedFallbacks = fallbackCandidates.filter((modelRef): modelRef is string => {
    if (typeof modelRef !== "string" || modelRef.trim().length === 0) {
      return false;
    }
    return !enforceProviderAllowlist || isAllowedModelRef(modelRef);
  });
  const fallbackModels =
    allowedFallbacks.length > 0 ? allowedFallbacks : [...DEFAULT_FALLBACK_MODELS];

  const existingModelAliases = Object.entries(cfg.agents?.defaults?.models ?? {}).filter(
    ([modelRef]) => !enforceProviderAllowlist || isAllowedModelRef(modelRef),
  );
  const filteredModelAliases = Object.fromEntries(existingModelAliases);

  const filteredProviders = Object.fromEntries(
    Object.entries(cfg.models?.providers ?? {}).filter(
      ([providerId]) =>
        !enforceProviderAllowlist || ALLOWED_PROVIDER_IDS.has(normalizeProviderId(providerId)),
    ),
  );

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
          primary: primaryModel,
          fallbacks: fallbackModels,
        },
        models: {
          ...DEFAULT_MODEL_ALIASES,
          ...filteredModelAliases,
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
        ...filteredProviders,
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
