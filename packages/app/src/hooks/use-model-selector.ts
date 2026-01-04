import { createModelInstance } from "@/ai/providers/factory";
import { type SelectedModel, useProviderStore } from "@/store/provider-store";
import { useCallback, useEffect, useMemo } from "react";

type ModelPurpose = "chat" | "translate";

export function useModelSelector(defaultProviderId?: string, defaultModelId?: string, purpose: ModelPurpose = "chat") {
  const {
    modelProviders,
    selectedModel,
    selectedTranslateModel,
    setSelectedModel,
    setSelectedTranslateModel,
  } = useProviderStore();
  const activeSelected = purpose === "translate" ? selectedTranslateModel : selectedModel;
  const setActiveSelected = purpose === "translate" ? setSelectedTranslateModel : setSelectedModel;

  const resolveFirstActiveModel = useCallback(() => {
    for (const provider of modelProviders) {
      if (!provider.active) continue;
      const activeModel = provider.models.find((model) => model.active);
      if (activeModel) {
        return {
          modelId: activeModel.id,
          providerId: provider.provider,
          providerName: provider.name,
          modelName: activeModel.name || activeModel.id,
        } as SelectedModel;
      }
    }
    return null;
  }, [modelProviders]);

  const resolveDefaultModel = useCallback(() => {
    if (!defaultProviderId || !defaultModelId) return null;
    const provider = modelProviders.find((p) => p.provider === defaultProviderId && p.active);
    if (!provider) return null;
    const model = provider.models.find((m) => m.id === defaultModelId && m.active);
    if (!model) return null;
    return {
      modelId: model.id,
      providerId: provider.provider,
      providerName: provider.name,
      modelName: model.name || model.id,
    } as SelectedModel;
  }, [defaultProviderId, defaultModelId, modelProviders]);

  useEffect(() => {
    if (!activeSelected) {
      let initialModel: SelectedModel | null = resolveDefaultModel();

      if (!initialModel && purpose === "translate" && selectedModel) {
        initialModel = selectedModel;
      }

      if (!initialModel) {
        initialModel = resolveFirstActiveModel();
      }

      if (initialModel) {
        setActiveSelected(initialModel);
      }
    }
  }, [
    activeSelected,
    resolveDefaultModel,
    resolveFirstActiveModel,
    purpose,
    selectedModel,
    setActiveSelected,
  ]);

  const currentModelInstance = useMemo(() => {
    if (!activeSelected) return null;

    try {
      return createModelInstance(activeSelected.providerId, activeSelected.modelId);
    } catch (error) {
      console.error("Failed to create model instance:", error);
      return null;
    }
  }, [activeSelected]);

  const handleModelSelect = useCallback(
    (model: SelectedModel) => {
      setActiveSelected(model);
    },
    [setActiveSelected],
  );

  const availableModels = useMemo(() => {
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
            providerIcon: provider.icon,
          })),
      );
  }, [modelProviders]);

  return {
    selectedModel: activeSelected,
    setSelectedModel: handleModelSelect,
    currentModelInstance,
    availableModels,
  };
}
