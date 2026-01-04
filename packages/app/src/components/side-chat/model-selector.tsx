import { Anthropic, DeepSeek, Gemini, Grok, OpenAI, OpenRouter } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { type SelectedModel, useProviderStore } from "@/store/provider-store";
import { Check, ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { SVGProps } from "react";

const providerIcons: Record<string, React.ComponentType<SVGProps<SVGSVGElement>>> = {
  openai: OpenAI,
  anthropic: Anthropic,
  openrouter: OpenRouter,
  grok: Grok,
  gemini: Gemini,
  deepseek: DeepSeek,
};

interface ModelSelectorProps {
  selectedModel: SelectedModel | null;
  onModelSelect: (model: SelectedModel) => void;
  selectedTranslateModel?: SelectedModel | null;
  onTranslateSelect?: (model: SelectedModel) => void;
  className?: string;
}

type ModelScope = "all" | "chat" | "translate";

export default function ModelSelector({
  selectedModel,
  onModelSelect,
  selectedTranslateModel,
  onTranslateSelect,
  className,
}: ModelSelectorProps) {
  const { modelProviders } = useProviderStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<ModelScope>("all");

  const availableModels = useMemo(() => {
    const models: Array<{
      modelId: string;
      providerId: string;
      providerName: string;
      modelName: string;
    }> = [];

    modelProviders.forEach((provider) => {
      if (!provider.active) return;

      provider.models.forEach((model) => {
        if (model.active) {
          models.push({
            modelId: model.id,
            providerId: provider.provider,
            providerName: provider.name,
            modelName: model.name || model.id,
          });
        }
      });
    });

    return models;
  }, [modelProviders]);

  const filteredModels = useMemo(() => {
    if (!searchTerm.trim()) return availableModels;

    return availableModels.filter(
      (model) =>
        model.modelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        model.providerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        model.modelId.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [availableModels, searchTerm]);

  const groupedModels = useMemo(() => {
    const groups: Record<string, typeof filteredModels> = {};

    filteredModels.forEach((model) => {
      if (!groups[model.providerId]) {
        groups[model.providerId] = [];
      }
      groups[model.providerId].push(model);
    });

    return groups;
  }, [filteredModels]);

  const resolveSelectionLabel = () => {
    if (scope === "chat") {
      return selectedModel?.modelName || "选择模型";
    }
    if (scope === "translate") {
      return selectedTranslateModel?.modelName || "选择模型";
    }
    if (selectedModel && selectedTranslateModel) {
      if (
        selectedModel.providerId === selectedTranslateModel.providerId &&
        selectedModel.modelId === selectedTranslateModel.modelId
      ) {
        return selectedModel.modelName;
      }
      return "选择模型";
    }
    return selectedModel?.modelName || selectedTranslateModel?.modelName || "选择模型";
  };

  const resolvedSelectedModel = () => {
    if (scope === "translate") {
      return selectedTranslateModel;
    }
    if (scope === "chat") {
      return selectedModel;
    }
    return selectedModel || selectedTranslateModel;
  };

  const handleModelSelect = (model: (typeof filteredModels)[0]) => {
    const selected: SelectedModel = {
      modelId: model.modelId,
      providerId: model.providerId,
      providerName: model.providerName,
      modelName: model.modelName,
    };

    if (scope === "translate") {
      if (onTranslateSelect) {
        onTranslateSelect(selected);
      } else {
        onModelSelect(selected);
      }
    } else if (scope === "chat") {
      onModelSelect(selected);
    } else {
      onModelSelect(selected);
      if (onTranslateSelect) {
        onTranslateSelect(selected);
      }
    }

    setOpen(false);
    setSearchTerm("");
  };

  const getProviderIcon = (providerId: string) => {
    return providerIcons[providerId] || null;
  };

  const selectedForDisplay = resolvedSelectedModel();
  const selectionLabel = resolveSelectionLabel();

  return (
    <div className="flex min-w-0 items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex h-8 cursor-pointer select-none items-center gap-1 rounded-2xl border bg-background px-2 text-xs dark:bg-neutral-800 dark:text-neutral-200 dark:hover:border-neutral-600">
            <span className="text-muted-foreground dark:text-neutral-400">
              {scope === "all" ? "全部" : scope === "chat" ? "对话" : "翻译"}
            </span>
            <ChevronDown className="h-3 w-3" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-28 dark:border-neutral-700 dark:bg-neutral-800" align="start">
          <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => setScope("all")}>
            全部
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => setScope("chat")}>
            对话
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => setScope("translate")}>
            翻译
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <div
            className={cn(
              "flex h-8 min-w-0 cursor-pointer select-none items-center justify-between gap-2 overflow-hidden rounded-2xl border bg-background px-3 font-normal text-sm dark:bg-neutral-800 dark:text-neutral-200 dark:hover:border-neutral-600",
              className,
            )}
          >
            <div className="flex min-w-0 items-center gap-2 truncate">
              {selectedForDisplay ? (
                <>
                  {(() => {
                    const IconComponent = getProviderIcon(selectedForDisplay.providerId);
                    return IconComponent ? <IconComponent className="h-4 w-4 flex-shrink-0" /> : null;
                  })()}
                  <span className="truncate text-xs" title={selectionLabel}>
                    {selectionLabel}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground text-xs dark:text-neutral-400">选择模型</span>
              )}
            </div>
            <ChevronDown className="h-3 w-3 flex-shrink-0" />
          </div>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-64 overflow-hidden dark:border-neutral-700 dark:bg-neutral-800" align="start">
        <div className="p-2">
          <div className="relative">
            <Search className="absolute top-2.5 left-2 h-3 w-3 text-muted-foreground dark:text-neutral-400" />
            <Input
              placeholder="搜索模型..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-7 text-xs dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-200 dark:placeholder:text-neutral-400"
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        <DropdownMenuSeparator />

        <div className="max-h-80 overflow-y-auto overflow-x-hidden">
          {Object.entries(groupedModels).length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm dark:text-neutral-400">
              没有找到匹配的模型
            </div>
          ) : (
            Object.entries(groupedModels).map(([providerId, models]) => (
              <div key={providerId}>
                <div className="flex items-center gap-2 py-2 pl-2 font-medium text-muted-foreground text-xs dark:text-neutral-400">
                  {(() => {
                    const IconComponent = getProviderIcon(providerId);
                    return IconComponent ? <IconComponent className="h-4 w-4" /> : null;
                  })()}
                  {models[0].providerName}
                </div>

                {models.map((model) => {
                  const isSelected =
                    (scope === "chat" &&
                      selectedModel?.providerId === model.providerId &&
                      selectedModel?.modelId === model.modelId) ||
                    (scope === "translate" &&
                      selectedTranslateModel?.providerId === model.providerId &&
                      selectedTranslateModel?.modelId === model.modelId) ||
                    (scope === "all" &&
                      ((selectedModel?.providerId === model.providerId &&
                        selectedModel?.modelId === model.modelId) ||
                        (selectedTranslateModel?.providerId === model.providerId &&
                          selectedTranslateModel?.modelId === model.modelId)));
                  return (
                    <DropdownMenuItem
                      key={`${model.providerId}-${model.modelId}`}
                      className="cursor-pointer p-2 dark:hover:bg-neutral-700"
                      onClick={() => handleModelSelect(model)}
                    >
                      <div className="flex flex-1 flex-col gap-1 truncate" title={model.modelName}>
                        <div className="truncate font-medium text-xs dark:text-neutral-200">{model.modelName}</div>
                        {model.modelName !== model.modelId && (
                          <div className="truncate text-[10px] text-muted-foreground dark:text-neutral-400">
                            {model.modelId}
                          </div>
                        )}
                      </div>
                      {isSelected && <Check className="h-4 w-4 flex-shrink-0 dark:text-neutral-200" />}
                    </DropdownMenuItem>
                  );
                })}

                <DropdownMenuSeparator />
              </div>
            ))
          )}
        </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
