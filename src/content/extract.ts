function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function textFromElement(element: Element | null): string {
  if (!element) {
    return "";
  }
  return normalizeText(element.textContent ?? "");
}

function findBestDescriptionBlock(): string {
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
      const text = textFromElement(node);
      if (text.length > 300) {
        candidates.push(text);
      }
    });
  }

  const selectedText = normalizeText(window.getSelection()?.toString() ?? "");
  if (selectedText.length > 100) {
    candidates.unshift(selectedText);
  }

  candidates.sort((a, b) => b.length - a.length);
  return candidates[0] ?? normalizeText(document.body?.innerText ?? "");
}

function buildJobText(): string {
  const title = textFromElement(document.querySelector("h1"));
  const company = textFromElement(
    document.querySelector("[data-company], [class*='company'], [id*='company']")
  );
  const body = findBestDescriptionBlock();
  const lines = [title, company, body].filter(Boolean);

  return lines.join("\n\n").slice(0, 16000);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "GET_JOB_TEXT") {
    return;
  }

  sendResponse({
    jobText: buildJobText(),
    pageTitle: document.title,
    url: window.location.href
  });
});
