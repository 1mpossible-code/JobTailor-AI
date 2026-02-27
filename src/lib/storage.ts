import type { AppSettings } from "./types.js";

const SETTINGS_KEY = "appSettings";
const LOCAL_RESUME_KEY = "resumeText";
const SESSION_RESUME_KEY = "resumeText";

export const DEFAULT_SETTINGS: AppSettings = {
  provider: "anthropic",
  tone: "professional",
  length: "standard",
  sessionOnlyResume: false,
  models: {
    anthropic: "claude-3-5-haiku-latest",
    openai: "gpt-4.1-mini"
  },
  apiKeys: {
    anthropic: "",
    openai: ""
  }
};

export async function getSettings(): Promise<AppSettings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const raw = stored[SETTINGS_KEY] ?? {};

  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    models: {
      ...DEFAULT_SETTINGS.models,
      ...(raw.models ?? {})
    },
    apiKeys: {
      ...DEFAULT_SETTINGS.apiKeys,
      ...(raw.apiKeys ?? {})
    }
  };
}

export async function saveSettings(next: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const merged: AppSettings = {
    ...current,
    ...next,
    models: {
      ...current.models,
      ...(next.models ?? {})
    },
    apiKeys: {
      ...current.apiKeys,
      ...(next.apiKeys ?? {})
    }
  };

  await chrome.storage.local.set({ [SETTINGS_KEY]: merged });
  return merged;
}

export async function getResumeText(settings?: AppSettings): Promise<string> {
  const activeSettings = settings ?? (await getSettings());

  if (activeSettings.sessionOnlyResume) {
    const result = await chrome.storage.session.get(SESSION_RESUME_KEY);
    return String(result[SESSION_RESUME_KEY] ?? "");
  }

  const result = await chrome.storage.local.get(LOCAL_RESUME_KEY);
  return String(result[LOCAL_RESUME_KEY] ?? "");
}

export async function saveResumeText(text: string, sessionOnly: boolean): Promise<void> {
  if (sessionOnly) {
    await chrome.storage.local.remove(LOCAL_RESUME_KEY);
    await chrome.storage.session.set({ [SESSION_RESUME_KEY]: text });
    return;
  }

  await chrome.storage.session.remove(SESSION_RESUME_KEY);
  await chrome.storage.local.set({ [LOCAL_RESUME_KEY]: text });
}

export async function clearResumeText(): Promise<void> {
  await chrome.storage.local.remove(LOCAL_RESUME_KEY);
  await chrome.storage.session.remove(SESSION_RESUME_KEY);
}
