import { useProviderStore } from "@/store/provider-store";
import { normalizeOpenAICompatibleBaseUrl } from "@/utils/provider";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { fetch as fetchTauri } from "@tauri-apps/plugin-http";

export interface ProviderConfig {
  providerId: string;
  apiKey?: string;
  baseUrl?: string;
}

function isOfficialOpenAIBaseUrl(baseUrl?: string): boolean {
  if (!baseUrl) return true;
  try {
    const u = new URL(baseUrl);
    return u.hostname === "api.openai.com";
  } catch {
    // If it's not a valid URL, treat as non-official to avoid calling OpenAI-only endpoints.
    return false;
  }
}

/**
 * 动态创建AI提供商实例
 */
export function createProviderInstance(config: ProviderConfig) {
  const { providerId, apiKey, baseUrl } = config;
  const normalizedBaseUrl = normalizeOpenAICompatibleBaseUrl(baseUrl);

  switch (providerId) {
    case "deepseek":
      return createDeepSeek({
        apiKey: apiKey || "",
        baseURL: normalizedBaseUrl,
        // Use Tauri HTTP to avoid browser CORS in desktop app
        fetch: fetchTauri,
      });

    case "openrouter":
      return createOpenRouter({
        apiKey: apiKey || "",
        baseURL: normalizedBaseUrl,
      });

    case "openai":
      // Many local models (e.g. Ollama) advertise “OpenAI compatible” but do NOT implement
      // OpenAI-specific newer endpoints. Using `createOpenAI` may call endpoints that return 404.
      // When baseUrl is not the official OpenAI API, use the compatible adapter.
      if (!isOfficialOpenAIBaseUrl(normalizedBaseUrl)) {
        return createOpenAICompatible({
          apiKey: apiKey || "",
          baseURL: normalizedBaseUrl,
          includeUsage: true,
          name: "OpenAI Compatible",
          fetch: fetchTauri,
        });
      }

      return createOpenAI({
        apiKey: apiKey || "",
        baseURL: normalizedBaseUrl,
        // Use Tauri HTTP to avoid browser CORS in desktop app
        fetch: fetchTauri,
      });

    case "anthropic":
      return createOpenAICompatible({
        apiKey: apiKey || "",
        baseURL: normalizedBaseUrl || "https://api.anthropic.com/v1",
        includeUsage: true,
        name: "OpenAI Compatible",
        fetch: fetchTauri,
      });

    case "gemini":
    case "google":
      return createGoogleGenerativeAI({
        apiKey: apiKey || "https://generativelanguage.googleapis.com/v1beta",
        baseURL: baseUrl,
      });

    case "grok":
      // Grok 使用 OpenAI 兼容的 API
      return createOpenAI({
        apiKey: apiKey || "",
        baseURL: normalizedBaseUrl || "https://api.x.ai/v1",
        fetch: fetchTauri,
      });

    default:
      return createOpenAICompatible({
        apiKey: apiKey || "",
        baseURL: normalizedBaseUrl || "https://api.openai.com/v1",
        includeUsage: true,
        name: "OpenAI Compatible",
        fetch: fetchTauri,
      });
  }
}

/**
 * 根据提供商ID和模型ID创建模型实例
 */
export function createModelInstance(providerId: string, modelId: string) {
  // 从store获取提供商配置
  const { modelProviders } = useProviderStore.getState();
  const provider = modelProviders.find((p) => p.provider === providerId);

  if (!provider) {
    throw new Error(`Provider not found: ${providerId}`);
  }

  if (!provider.active) {
    throw new Error(`Provider is not active: ${providerId}`);
  }

  const model = provider.models.find((m) => m.id === modelId);
  if (!model || !model.active) {
    throw new Error(`Model not found or not active: ${modelId}`);
  }

  // 创建提供商实例
  const providerInstance = createProviderInstance({
    providerId,
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
  });

  // 返回模型实例
  return providerInstance(modelId);
}

/**
 * Hook: 获取可用的模型列表
 */
export function useAvailableModels() {
  const { modelProviders } = useProviderStore();

  return modelProviders
    .filter((provider) => provider.active)
    .flatMap((provider) =>
      provider.models
        .filter((model) => model.active)
        .map((model) => ({
          modelId: model.id,
          providerId: provider.provider,
          providerName: provider.name,
          modelName: model.name || model.id,
        })),
    );
}
