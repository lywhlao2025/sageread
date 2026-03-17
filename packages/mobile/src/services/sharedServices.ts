import { createNoteService, createThreadService } from "sageread-shared";
import Constants from "expo-constants";
import { apiClient } from "./apiClient";
import { mockNoteService, mockThreadService } from "./mockServices";

const useMock = Boolean(Constants.expoConfig?.extra?.useMock);

export const noteService = useMock ? mockNoteService : createNoteService(apiClient);
export const threadService = useMock ? mockThreadService : createThreadService(apiClient);
