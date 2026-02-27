import {
  clearResumeText,
  getResumeText,
  getSettings,
  saveResumeText,
  saveSettings
} from "../lib/storage.js";
import type { LetterLength, Provider, Tone } from "../lib/types.js";

const providerEl = document.querySelector<HTMLSelectElement>("#provider");
const toneEl = document.querySelector<HTMLSelectElement>("#tone");
const lengthEl = document.querySelector<HTMLSelectElement>("#length");
const anthropicApiKeyEl = document.querySelector<HTMLInputElement>("#anthropicApiKey");
const openaiApiKeyEl = document.querySelector<HTMLInputElement>("#openaiApiKey");
const anthropicModelEl = document.querySelector<HTMLInputElement>("#anthropicModel");
const openaiModelEl = document.querySelector<HTMLInputElement>("#openaiModel");
const resumeTextEl = document.querySelector<HTMLTextAreaElement>("#resumeText");
const sessionOnlyResumeEl = document.querySelector<HTMLInputElement>("#sessionOnlyResume");
const saveBtn = document.querySelector<HTMLButtonElement>("#saveBtn");
const clearResumeBtn = document.querySelector<HTMLButtonElement>("#clearResumeBtn");
const statusEl = document.querySelector<HTMLParagraphElement>("#status");

function setStatus(text: string, isError = false): void {
  if (!statusEl) {
    return;
  }
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

async function load(): Promise<void> {
  if (
    !providerEl ||
    !toneEl ||
    !lengthEl ||
    !anthropicApiKeyEl ||
    !openaiApiKeyEl ||
    !anthropicModelEl ||
    !openaiModelEl ||
    !resumeTextEl ||
    !sessionOnlyResumeEl
  ) {
    return;
  }

  const settings = await getSettings();
  const resume = await getResumeText(settings);

  providerEl.value = settings.provider;
  toneEl.value = settings.tone;
  lengthEl.value = settings.length;
  anthropicApiKeyEl.value = settings.apiKeys.anthropic;
  openaiApiKeyEl.value = settings.apiKeys.openai;
  anthropicModelEl.value = settings.models.anthropic;
  openaiModelEl.value = settings.models.openai;
  sessionOnlyResumeEl.checked = settings.sessionOnlyResume;
  resumeTextEl.value = resume;
}

async function save(): Promise<void> {
  if (
    !providerEl ||
    !toneEl ||
    !lengthEl ||
    !anthropicApiKeyEl ||
    !openaiApiKeyEl ||
    !anthropicModelEl ||
    !openaiModelEl ||
    !resumeTextEl ||
    !sessionOnlyResumeEl
  ) {
    return;
  }

  const provider = providerEl.value as Provider;
  const tone = toneEl.value as Tone;
  const length = lengthEl.value as LetterLength;
  const sessionOnlyResume = sessionOnlyResumeEl.checked;

  await saveSettings({
    provider,
    tone,
    length,
    sessionOnlyResume,
    apiKeys: {
      anthropic: anthropicApiKeyEl.value.trim(),
      openai: openaiApiKeyEl.value.trim()
    },
    models: {
      anthropic: anthropicModelEl.value.trim() || "claude-3-5-haiku-latest",
      openai: openaiModelEl.value.trim() || "gpt-4.1-mini"
    }
  });

  await saveResumeText(resumeTextEl.value.trim(), sessionOnlyResume);
  setStatus("Settings saved.");
}

async function clearResume(): Promise<void> {
  if (!resumeTextEl) {
    return;
  }

  await clearResumeText();
  resumeTextEl.value = "";
  setStatus("Resume cleared.");
}

function bindEvents(): void {
  saveBtn?.addEventListener("click", async () => {
    try {
      await save();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save settings.";
      setStatus(message, true);
    }
  });

  clearResumeBtn?.addEventListener("click", async () => {
    try {
      await clearResume();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to clear resume.";
      setStatus(message, true);
    }
  });
}

bindEvents();
void load();
