import type { AppSettings, PopupDraft } from "./types.js";

const SETTINGS_KEY = "appSettings";
const LOCAL_RESUME_KEY = "resumeText";
const SESSION_RESUME_KEY = "resumeText";
const POPUP_DRAFT_KEY_PREFIX = "popupDraft:";

function getPopupDraftKey(tabId: number): string {
  return `${POPUP_DRAFT_KEY_PREFIX}${tabId}`;
}

export const DEFAULT_SETTINGS: AppSettings = {
  provider: "anthropic",
  tone: "professional",
  length: "standard",
  fullName: "",
  sessionOnlyResume: false,
  models: {
    anthropic: "claude-3-5-haiku-latest",
    openai: "gpt-4.1-mini",
    gemini: "gemini-2.0-flash"
  },
  apiKeys: {
    anthropic: "",
    openai: "",
    gemini: ""
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

export async function getPopupDraft(tabId: number): Promise<PopupDraft | null> {
  const key = getPopupDraftKey(tabId);
  const result = await chrome.storage.session.get(key);
  const raw = result[key] as Partial<PopupDraft> | undefined;

  if (!raw || typeof raw !== "object") {
    return null;
  }

  const jobText = String(raw.jobText ?? "").trim();
  const provider = raw.provider;
  const tone = raw.tone;
  const length = raw.length;
  const activeTab = raw.activeTab;

  if (!provider || !tone || !length || !activeTab) {
    return null;
  }

  return {
    jobText,
    pageTitle: String(raw.pageTitle ?? ""),
    url: String(raw.url ?? ""),
    provider,
    tone,
    length,
    output: String(raw.output ?? ""),
    questionInput: String(raw.questionInput ?? ""),
    answerOutput: String(raw.answerOutput ?? ""),
    activeTab
  };
}

export async function savePopupDraft(tabId: number, draft: PopupDraft): Promise<void> {
  const key = getPopupDraftKey(tabId);
  await chrome.storage.session.set({
    [key]: {
      jobText: draft.jobText.trim(),
      pageTitle: draft.pageTitle,
      url: draft.url,
      provider: draft.provider,
      tone: draft.tone,
      length: draft.length,
      output: draft.output,
      questionInput: draft.questionInput,
      answerOutput: draft.answerOutput,
      activeTab: draft.activeTab
    }
  });
}

export async function clearPopupDraft(tabId: number): Promise<void> {
  const key = getPopupDraftKey(tabId);
  await chrome.storage.session.remove(key);
}
