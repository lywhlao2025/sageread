import { useState } from "react";

export type ViewMode = "grid" | "list";

export const useLibraryUI = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  return {
    viewMode,
    setViewMode,
  };
};
