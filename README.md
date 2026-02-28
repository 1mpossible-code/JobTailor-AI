# AI Cover Letter Chrome Extension

Client-only Chrome extension that:

- extracts a job description from the current page,
- remembers your resume text locally,
- generates tailored cover letters with either Anthropic or OpenAI API keys.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Build the extension:

```bash
npm run build
```

3. Open Chrome and go to `chrome://extensions`.
4. Enable **Developer mode**.
5. Click **Load unpacked** and select the `dist` folder.

## Usage

1. Open extension **Settings** and paste:
   - your resume text,
   - Anthropic and/or OpenAI API keys,
   - preferred models.
2. Open a job posting page.
3. In the popup:
   - click **Extract from page** (or paste the description manually),
   - choose provider/tone/length,
   - click **Generate**.
4. Copy the generated cover letter, or click **Get PDF** for a formal one-page PDF business-letter version.
5. Use the **Question Answer** tab to generate a one-paragraph answer for application prompts based on the same resume + job description context.

## Keyboard Access

- Open popup shortcut suggestion: `Ctrl+Shift+Y` (Windows/Linux) or `Command+Shift+Y` (Mac).
- You can customize this in `chrome://extensions/shortcuts` (some combinations may be unavailable on your system).
- In popup (when focus is not in an input field):
  - `e` extract from page
  - `g` generate (cover letter or answer, based on active tab)
  - `y` copy (cover letter or answer, based on active tab)
  - `1` cover letter tab
  - `2` question answer tab
  - `Esc` close popup

## Notes

- No OAuth is used.
- API calls are made directly from the extension to provider APIs.
- Resume text and keys are stored in Chrome extension storage for your local profile.
