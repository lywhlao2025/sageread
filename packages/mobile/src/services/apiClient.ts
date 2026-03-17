import { createHttpClient } from "sageread-shared";

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "https://api.readest.com";
const API_TOKEN = process.env.EXPO_PUBLIC_API_TOKEN;

export const apiClient = createHttpClient(
  BASE_URL,
  {
    Accept: "application/json",
    ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
  },
  {
    timeoutMs: 15000,
    retries: 1,
  },
);
