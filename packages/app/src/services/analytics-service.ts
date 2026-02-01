import { useModeStore } from "@/store/mode-store";
import { getLocale, getOSPlatform } from "@/utils/misc";
import type * as amplitude from "@amplitude/analytics-browser";

const apiKey = import.meta.env.VITE_AMPLITUDE_API_KEY;
let initialized = false;
let amplitudeModule: typeof amplitude | null = null;
const amplitudeModuleName = "@amplitude/analytics-browser";

const loadAmplitude = async () => {
  if (amplitudeModule) return amplitudeModule;
  try {
    amplitudeModule = await import(/* @vite-ignore */ amplitudeModuleName);
    return amplitudeModule;
  } catch (error) {
    console.warn("Amplitude SDK not available:", error);
    return null;
  }
};

const getCommonProps = () => ({
  os: getOSPlatform(),
  lang: getLocale(),
  mode: useModeStore.getState().mode ?? "unknown",
});

export const initAnalytics = () => {
  if (!apiKey || initialized) return;
  void loadAmplitude().then((module) => {
    if (!module || initialized) return;
    module.init(apiKey, {
      defaultTracking: false,
    });
    initialized = true;
  });
};

export const trackEvent = (event: string, props: Record<string, unknown> = {}) => {
  if (!apiKey) return;
  void loadAmplitude().then((module) => {
    if (!module) return;
    if (!initialized) {
      module.init(apiKey, {
        defaultTracking: false,
      });
      initialized = true;
    }
    module.track(event, {
      ...getCommonProps(),
      ...props,
    });
  });
};
