import { getResumeText, getSettings } from "../lib/storage.js";
import type { AppSettings, LetterLength, Provider, Tone } from "../lib/types.js";

const providerEl = document.querySelector<HTMLSelectElement>("#provider");
const toneEl = document.querySelector<HTMLSelectElement>("#tone");
const lengthEl = document.querySelector<HTMLSelectElement>("#length");
const jobTextEl = document.querySelector<HTMLTextAreaElement>("#jobText");
const outputEl = document.querySelector<HTMLTextAreaElement>("#output");
const statusEl = document.querySelector<HTMLParagraphElement>("#status");
const extractBtn = document.querySelector<HTMLButtonElement>("#extractBtn");
const generateBtn = document.querySelector<HTMLButtonElement>("#generateBtn");
const regenerateBtn = document.querySelector<HTMLButtonElement>("#regenerateBtn");
const copyBtn = document.querySelector<HTMLButtonElement>("#copyBtn");

let cachedResume = "";
let settings: AppSettings;

function setStatus(text: string, isError = false): void {
  if (!statusEl) {
    return;
  }

  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

function setLoading(isLoading: boolean): void {
  [extractBtn, generateBtn, regenerateBtn].forEach((button) => {
    if (button) {
      button.disabled = isLoading;
    }
  });

  if (generateBtn) {
    generateBtn.textContent = isLoading ? "Generating..." : "Generate";
  }
}

async function extractFromActiveTab(): Promise<string> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error("No active tab found.");
  }

  let jobText = "";

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_JOB_TEXT" });
    jobText = String(response?.jobText ?? "").trim();
  } catch {
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const normalize = (text: string): string => text.replace(/\s+/g, " ").trim();
        const textFrom = (el: Element | null): string => (el ? normalize(el.textContent ?? "") : "");
        const selectors = [
          "[data-testid*='job']",
          "[class*='job-description']",
          "[id*='job-description']",
          "article",
          "main",
          "section"
        ];
        const candidates: string[] = [];

        for (const selector of selectors) {
          document.querySelectorAll(selector).forEach((node) => {
            const text = textFrom(node);
            if (text.length > 300) {
              candidates.push(text);
            }
          });
        }

        const selection = normalize(window.getSelection()?.toString() ?? "");
        if (selection.length > 100) {
          candidates.unshift(selection);
        }

        candidates.sort((a, b) => b.length - a.length);

        const title = textFrom(document.querySelector("h1"));
        const company = textFrom(
          document.querySelector("[data-company], [class*='company'], [id*='company']")
        );
        const body = candidates[0] ?? normalize(document.body?.innerText ?? "");
        return [title, company, body].filter(Boolean).join("\n\n").slice(0, 16000);
      }
    });

    jobText = String(result[0]?.result ?? "").trim();
  }

  if (!jobText) {
    throw new Error("Could not extract content from this page. Paste the job description manually.");
  }

  return jobText;
}

async function generate(): Promise<void> {
  if (!providerEl || !toneEl || !lengthEl || !jobTextEl || !outputEl) {
    return;
  }

  settings = await getSettings();
  cachedResume = await getResumeText(settings);

  const jobText = jobTextEl.value.trim();
  if (!jobText) {
    setStatus("Add or extract a job description first.", true);
    return;
  }

  if (!cachedResume.trim()) {
    setStatus("No resume found. Add your resume in Settings.", true);
    return;
  }

  setLoading(true);
  setStatus("Generating cover letter...");

  const provider = providerEl.value as Provider;
  const tone = toneEl.value as Tone;
  const length = lengthEl.value as LetterLength;
  const model = settings.models[provider];

  const response = await chrome.runtime.sendMessage({
    type: "GENERATE_COVER_LETTER",
    payload: {
      provider,
      tone,
      length,
      model,
      jobText,
      resumeText: cachedResume
    }
  });

  setLoading(false);

  if (!response?.ok) {
    setStatus(String(response?.error ?? "Generation failed."), true);
    return;
  }

  const letter = String(response.data?.letter ?? "");
  outputEl.value = letter;
  copyBtn && (copyBtn.disabled = !letter.trim());
  setStatus("Done.");
}

async function init(): Promise<void> {
  if (!providerEl || !toneEl || !lengthEl || !jobTextEl || !outputEl || !extractBtn || !generateBtn || !regenerateBtn || !copyBtn) {
    return;
  }

  settings = await getSettings();
  cachedResume = await getResumeText(settings);

  providerEl.value = settings.provider;
  toneEl.value = settings.tone;
  lengthEl.value = settings.length;
  copyBtn.disabled = true;

  extractBtn.addEventListener("click", async () => {
    try {
      setLoading(true);
      setStatus("Extracting from page...");
      const text = await extractFromActiveTab();
      jobTextEl.value = text;
      setStatus("Job description extracted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to extract job description.";
      setStatus(message, true);
    } finally {
      setLoading(false);
    }
  });

  generateBtn.addEventListener("click", async () => {
    try {
      await generate();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed.";
      setLoading(false);
      setStatus(message, true);
    }
  });

  regenerateBtn.addEventListener("click", async () => {
    try {
      await generate();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Regeneration failed.";
      setLoading(false);
      setStatus(message, true);
    }
  });

  copyBtn.addEventListener("click", async () => {
    const text = outputEl.value.trim();
    if (!text) {
      return;
    }
    await navigator.clipboard.writeText(text);
    setStatus("Copied to clipboard.");
  });
}

void init();
