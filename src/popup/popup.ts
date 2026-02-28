import { getResumeText, getSettings } from "../lib/storage.js";
import type { AppSettings, LetterLength, Provider, Tone } from "../lib/types.js";

interface ExtractedJob {
  jobText: string;
  pageTitle: string;
  url: string;
}

interface JsPdfWindow {
  jspdf?: {
    jsPDF: new (options?: { unit?: string; format?: string }) => {
      setFont: (fontName: string, fontStyle: string) => void;
      setFontSize: (size: number) => void;
      splitTextToSize: (text: string, size: number) => string[];
      text: (text: string | string[], x: number, y: number, options?: { baseline?: string }) => void;
      save: (filename: string) => void;
    };
  };
}

const providerEl = document.querySelector<HTMLSelectElement>("#provider");
const toneEl = document.querySelector<HTMLSelectElement>("#tone");
const lengthEl = document.querySelector<HTMLSelectElement>("#length");
const jobTextEl = document.querySelector<HTMLTextAreaElement>("#jobText");
const outputEl = document.querySelector<HTMLTextAreaElement>("#output");
const questionInputEl = document.querySelector<HTMLTextAreaElement>("#questionInput");
const answerOutputEl = document.querySelector<HTMLTextAreaElement>("#answerOutput");
const statusEl = document.querySelector<HTMLParagraphElement>("#status");
const extractBtn = document.querySelector<HTMLButtonElement>("#extractBtn");
const generateBtn = document.querySelector<HTMLButtonElement>("#generateBtn");
const regenerateBtn = document.querySelector<HTMLButtonElement>("#regenerateBtn");
const generateAnswerBtn = document.querySelector<HTMLButtonElement>("#generateAnswerBtn");
const copyBtn = document.querySelector<HTMLButtonElement>("#copyBtn");
const copyAnswerBtn = document.querySelector<HTMLButtonElement>("#copyAnswerBtn");
const humanizeAnswerBtn = document.querySelector<HTMLButtonElement>("#humanizeAnswerBtn");
const downloadPdfBtn = document.querySelector<HTMLButtonElement>("#downloadPdfBtn");
const coverTabBtn = document.querySelector<HTMLButtonElement>("#coverTabBtn");
const answerTabBtn = document.querySelector<HTMLButtonElement>("#answerTabBtn");
const coverPanel = document.querySelector<HTMLElement>("#coverPanel");
const answerPanel = document.querySelector<HTMLElement>("#answerPanel");

let cachedResume = "";
let settings: AppSettings;
let lastPageTitle = "";
let activeTab: "cover" | "answer" = "cover";

function setStatus(text: string, isError = false): void {
  if (!statusEl) {
    return;
  }

  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

type LoadingContext = "extract" | "generate" | "pdf" | "answer" | "humanize-answer";

function setLoading(isLoading: boolean, context?: LoadingContext): void {
  [extractBtn, generateBtn, regenerateBtn, downloadPdfBtn, generateAnswerBtn, copyAnswerBtn, humanizeAnswerBtn].forEach((button) => {
    if (button) {
      button.disabled = isLoading;
    }
  });

  if (generateBtn) {
    generateBtn.textContent = isLoading && context === "generate" ? "Generating..." : "Generate";
  }

  if (downloadPdfBtn) {
    downloadPdfBtn.textContent = isLoading && context === "pdf" ? "Preparing..." : "Get PDF";
  }

  if (generateAnswerBtn) {
    generateAnswerBtn.textContent = isLoading && context === "answer" ? "Generating..." : "Generate";
  }

  if (humanizeAnswerBtn) {
    humanizeAnswerBtn.textContent = isLoading && context === "humanize-answer" ? "Humanizing..." : "Humanize";
  }
}

function setActiveTab(tab: "cover" | "answer"): void {
  if (!coverTabBtn || !answerTabBtn || !coverPanel || !answerPanel) {
    return;
  }

  activeTab = tab;
  const coverActive = tab === "cover";
  coverTabBtn.classList.toggle("active", coverActive);
  answerTabBtn.classList.toggle("active", !coverActive);
  coverPanel.classList.toggle("active", coverActive);
  answerPanel.classList.toggle("active", !coverActive);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

function bindKeyboardShortcuts(): void {
  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.repeat) {
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      window.close();
      return;
    }

    if (isEditableTarget(event.target)) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "1") {
      event.preventDefault();
      setActiveTab("cover");
      return;
    }
    if (key === "2") {
      event.preventDefault();
      setActiveTab("answer");
      return;
    }
    if (key === "e") {
      event.preventDefault();
      extractBtn?.click();
      return;
    }
    if (key === "g") {
      event.preventDefault();
      if (activeTab === "answer") {
        generateAnswerBtn?.click();
      } else {
        generateBtn?.click();
      }
      return;
    }
    if (key === "y") {
      event.preventDefault();
      if (activeTab === "answer") {
        copyAnswerBtn?.click();
      } else {
        copyBtn?.click();
      }
      return;
    }
    if (key === "h") {
      event.preventDefault();
      if (activeTab === "answer") {
        humanizeAnswerBtn?.click();
      } else {
        setStatus("Humanize is available in Question Answer tab.");
      }
    }
  });
}

async function extractFromActiveTab(): Promise<ExtractedJob> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error("No active tab found.");
  }

  let payload: ExtractedJob = { jobText: "", pageTitle: tab.title ?? "", url: tab.url ?? "" };

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_JOB_TEXT" });
    payload = {
      jobText: String(response?.jobText ?? "").trim(),
      pageTitle: String(response?.pageTitle ?? tab.title ?? ""),
      url: String(response?.url ?? tab.url ?? "")
    };
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
        return {
          jobText: [title, company, body].filter(Boolean).join("\n\n").slice(0, 16000),
          pageTitle: document.title,
          url: window.location.href
        };
      }
    });

    const extracted = result[0]?.result as ExtractedJob | undefined;
    payload = {
      jobText: String(extracted?.jobText ?? "").trim(),
      pageTitle: String(extracted?.pageTitle ?? tab.title ?? ""),
      url: String(extracted?.url ?? tab.url ?? "")
    };
  }

  if (!payload.jobText) {
    throw new Error("Could not extract content from this page. Paste the job description manually.");
  }

  return payload;
}

function sanitizeFilenamePart(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 50);
}

function getCurrentDateLine(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

function titleCaseWord(word: string): string {
  if (!word) {
    return word;
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function nameFromEmail(resumeText: string): string | null {
  const emailMatch = resumeText.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  if (!emailMatch) {
    return null;
  }

  const local = emailMatch[0].split("@")[0].replace(/[._-]+/g, " ").trim();
  const parts = local
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => /^[a-zA-Z]{2,}$/.test(part));

  if (parts.length < 2) {
    return null;
  }

  return parts.slice(0, 3).map(titleCaseWord).join(" ");
}

function nameFromLetterSignoff(letter: string): string | null {
  const lines = letter
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (/^(best|sincerely|regards|thank you)[,]?$|^best regards[,]?$/i.test(line) && i + 1 < lines.length) {
      const nameLine = lines[i + 1];
      if (/^[A-Za-z][A-Za-z\s.'-]{2,60}$/.test(nameLine)) {
        return nameLine;
      }
    }
  }

  return null;
}

function extractCandidateName(resumeText: string, letter?: string): string {
  const lines = resumeText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5);

  for (const line of lines) {
    const cleaned = line.replace(/\s+/g, " ");
    const directMatch = cleaned.match(/^[A-Za-z][A-Za-z\s.'-]{2,60}$/);
    if (directMatch) {
      return directMatch[0].trim();
    }

    const prefixMatch = cleaned.match(/^([A-Za-z][A-Za-z\s.'-]{2,60})\b(?:\s+[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\s+\+?\d)/);
    if (prefixMatch?.[1]) {
      return prefixMatch[1].trim();
    }
  }

  const emailBased = nameFromEmail(resumeText);
  if (emailBased) {
    return emailBased;
  }

  if (letter) {
    const signoffName = nameFromLetterSignoff(letter);
    if (signoffName) {
      return signoffName;
    }
  }

  return "Candidate";
}

function extractCompanyName(jobText: string, pageTitle: string): string {
  const companyLabelMatch = jobText.match(/\b(?:company|employer|organization)\s*[:\-]\s*([^\n|]{2,80})/i);
  if (companyLabelMatch?.[1]) {
    return companyLabelMatch[1].trim();
  }

  const titleAtMatch = pageTitle.match(/\bat\s+([^\-|]+)/i);
  if (titleAtMatch?.[1]) {
    return titleAtMatch[1].trim();
  }

  const lines = jobText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);

  const roleTerms = /\b(intern|engineer|developer|manager|director|analyst|specialist|scientist|position|role|job|software|backend|frontend|full[-\s]?stack|security|data)\b/i;
  const metaTerms = /\b(responsib|requirement|about|overview|qualification|benefit|salary|location)\b/i;

  const lineWithAt = lines.find((line) => /\bat\s+/i.test(line));
  if (lineWithAt) {
    const match = lineWithAt.match(/\bat\s+([^,|\-]{2,60})/i);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  const likelyLine = lines.find(
    (line) =>
      line.length >= 2 &&
      line.length <= 50 &&
      !/[.!?]/.test(line) &&
      !metaTerms.test(line) &&
      !roleTerms.test(line)
  );
  if (likelyLine) {
    return likelyLine;
  }

  const splitTitle = pageTitle
    .split(/[-|]/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (splitTitle.length > 1) {
    return splitTitle[1];
  }

  return "Company";
}

async function requestGeneration(outputFormat: "paste" | "pdf"): Promise<string> {
  if (!providerEl || !toneEl || !lengthEl || !jobTextEl) {
    throw new Error("Popup UI failed to initialize.");
  }

  settings = await getSettings();
  cachedResume = await getResumeText(settings);

  const jobText = jobTextEl.value.trim();
  if (!jobText) {
    throw new Error("Add or extract a job description first.");
  }

  if (!cachedResume.trim()) {
    throw new Error("No resume found. Add your resume in Settings.");
  }

  const provider = providerEl.value as Provider;
  const tone = toneEl.value as Tone;
  const length = outputFormat === "pdf" ? "standard" : (lengthEl.value as LetterLength);
  const model = settings.models[provider];
  const preferredName = settings.fullName.trim();

  const response = await chrome.runtime.sendMessage({
    type: "GENERATE_COVER_LETTER",
    payload: {
      provider,
      tone,
      length,
      model,
      outputFormat,
      currentDate: outputFormat === "pdf" ? getCurrentDateLine() : undefined,
      candidateName: preferredName || undefined,
      jobText,
      resumeText: cachedResume
    }
  });

  if (!response?.ok) {
    throw new Error(String(response?.error ?? "Generation failed."));
  }

  return String(response.data?.letter ?? "").trim();
}

async function requestQuestionAnswer(): Promise<string> {
  if (!providerEl || !toneEl || !jobTextEl || !questionInputEl) {
    throw new Error("Popup UI failed to initialize.");
  }

  settings = await getSettings();
  cachedResume = await getResumeText(settings);

  const jobText = jobTextEl.value.trim();
  const question = questionInputEl.value.trim();

  if (!jobText) {
    throw new Error("Add or extract a job description first.");
  }
  if (!question) {
    throw new Error("Enter an application question first.");
  }
  if (!cachedResume.trim()) {
    throw new Error("No resume found. Add your resume in Settings.");
  }

  const provider = providerEl.value as Provider;
  const tone = toneEl.value as Tone;
  const model = settings.models[provider];

  const response = await chrome.runtime.sendMessage({
    type: "GENERATE_QUESTION_ANSWER",
    payload: {
      provider,
      tone,
      model,
      jobText,
      question,
      resumeText: cachedResume
    }
  });

  if (!response?.ok) {
    throw new Error(String(response?.error ?? "Answer generation failed."));
  }

  return String(response.data?.answer ?? "").trim();
}

async function requestHumanizedText(text: string): Promise<string> {
  const response = await chrome.runtime.sendMessage({
    type: "GENERATE_HUMANIZED_TEXT",
    payload: {
      text
    }
  });

  if (!response?.ok) {
    throw new Error(String(response?.error ?? "Humanize request failed."));
  }

  return String(response.data?.text ?? "").trim();
}

function downloadPdf(letter: string, candidateName: string, companyName: string): void {
  const jsPdf = (window as JsPdfWindow).jspdf?.jsPDF;
  if (!jsPdf) {
    throw new Error("PDF library failed to load. Reload the extension and try again.");
  }

  const doc = new jsPdf({ unit: "pt", format: "letter" });
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 54;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;

  doc.setFont("helvetica", "normal");
  let fontSize = 12;
  let lines = doc.splitTextToSize(letter, usableWidth);
  let lineHeight = fontSize * 1.45;

  while (lines.length * lineHeight > usableHeight && fontSize > 10) {
    fontSize -= 0.5;
    doc.setFontSize(fontSize);
    lines = doc.splitTextToSize(letter, usableWidth);
    lineHeight = fontSize * 1.45;
  }

  const maxLines = Math.floor(usableHeight / lineHeight);
  if (lines.length > maxLines) {
    lines = lines.slice(0, Math.max(maxLines - 1, 1));
    lines.push("...");
  }

  doc.setFontSize(fontSize);
  doc.text(lines, margin, margin, { baseline: "top" });

  const safeName = sanitizeFilenamePart(candidateName) || "Candidate";
  const safeCompany = sanitizeFilenamePart(companyName) || "Company";
  doc.save(`${safeName}_Cover_Letter_${safeCompany}.pdf`);
}

async function generate(): Promise<void> {
  if (!outputEl) {
    return;
  }

  setLoading(true, "generate");
  setStatus("Generating cover letter...");

  try {
    const letter = await requestGeneration("paste");
    outputEl.value = letter;
    copyBtn && (copyBtn.disabled = !letter.trim());
    setStatus("Done.");
  } finally {
    setLoading(false);
  }
}

async function generateAndDownloadPdf(): Promise<void> {
  if (!jobTextEl) {
    return;
  }

  setLoading(true, "pdf");
  setStatus("Generating formal PDF letter...");

  try {
    const letter = await requestGeneration("pdf");
    const candidateName = settings.fullName.trim() || extractCandidateName(cachedResume, letter);
    const companyName = extractCompanyName(jobTextEl.value, lastPageTitle);
    downloadPdf(letter, candidateName, companyName);
    setStatus("PDF downloaded.");
  } finally {
    setLoading(false);
  }
}

async function generateQuestionAnswer(): Promise<void> {
  if (!answerOutputEl) {
    return;
  }

  setLoading(true, "answer");
  setStatus("Generating answer paragraph...");

  try {
    const answer = await requestQuestionAnswer();
    answerOutputEl.value = answer;
    if (copyAnswerBtn) {
      copyAnswerBtn.disabled = !answer;
    }
    setStatus("Answer ready.");
  } finally {
    setLoading(false);
  }
}

async function humanizeAnswer(): Promise<void> {
  if (!answerOutputEl) {
    return;
  }

  const source = answerOutputEl.value.trim();
  if (!source) {
    throw new Error("Generate an answer first.");
  }

  setLoading(true, "humanize-answer");
  setStatus("Humanizing answer...");

  try {
    const text = await requestHumanizedText(source);
    answerOutputEl.value = text;
    copyAnswerBtn && (copyAnswerBtn.disabled = !text);
    setStatus("Answer humanized.");
  } finally {
    setLoading(false);
  }
}

async function init(): Promise<void> {
  if (
    !providerEl ||
    !toneEl ||
    !lengthEl ||
    !jobTextEl ||
    !outputEl ||
    !questionInputEl ||
    !answerOutputEl ||
    !extractBtn ||
    !generateBtn ||
    !regenerateBtn ||
    !generateAnswerBtn ||
    !copyBtn ||
    !copyAnswerBtn ||
    !humanizeAnswerBtn ||
    !downloadPdfBtn ||
    !coverTabBtn ||
    !answerTabBtn ||
    !coverPanel ||
    !answerPanel
  ) {
    return;
  }

  settings = await getSettings();
  cachedResume = await getResumeText(settings);

  providerEl.value = settings.provider;
  toneEl.value = settings.tone;
  lengthEl.value = settings.length;
  copyBtn.disabled = true;
  copyAnswerBtn.disabled = true;
  setActiveTab("cover");
  bindKeyboardShortcuts();

  coverTabBtn.addEventListener("click", () => {
    setActiveTab("cover");
  });

  answerTabBtn.addEventListener("click", () => {
    setActiveTab("answer");
  });

  extractBtn.addEventListener("click", async () => {
    try {
      setLoading(true, "extract");
      setStatus("Extracting from page...");
      const extracted = await extractFromActiveTab();
      jobTextEl.value = extracted.jobText;
      lastPageTitle = extracted.pageTitle;
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

  downloadPdfBtn.addEventListener("click", async () => {
    try {
      await generateAndDownloadPdf();
    } catch (error) {
      const message = error instanceof Error ? error.message : "PDF generation failed.";
      setLoading(false);
      setStatus(message, true);
    }
  });

  generateAnswerBtn.addEventListener("click", async () => {
    try {
      await generateQuestionAnswer();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Answer generation failed.";
      setLoading(false);
      setStatus(message, true);
    }
  });

  copyAnswerBtn.addEventListener("click", async () => {
    const text = answerOutputEl.value.trim();
    if (!text) {
      return;
    }
    await navigator.clipboard.writeText(text);
    setStatus("Answer copied to clipboard.");
  });

  humanizeAnswerBtn.addEventListener("click", async () => {
    try {
      await humanizeAnswer();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Humanize failed.";
      setLoading(false);
      setStatus(message, true);
    }
  });
}

void init();
