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

## Notes

- No OAuth is used.
- API calls are made directly from the extension to provider APIs.
- Resume text and keys are stored in Chrome extension storage for your local profile.
