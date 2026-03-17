import type { ExpoConfig, ConfigContext } from "@expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  entryPoint: "./index.js",
  extra: {
    ...config.extra,
    useMock: process.env.EXPO_PUBLIC_USE_MOCK === "true",
  },
});
