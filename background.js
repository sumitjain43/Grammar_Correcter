const GEMINI_API_KEY = "GEMINI-API-KEY"; 

const GEMINI_MODEL = "gemini-2.5-flash"; 


function buildPrompt(text) {
  return `
You are an assistant that corrects English grammar, spelling, and punctuation.
When I give you some text, respond with a corrected version that is natural and clear in English.
Keep the original meaning and tone as close as possible.
Do not add new ideas or remove any important information.
Do not explain the changes.
Return only the corrected text, with no extra words or formatting.

Text:
${text}
  `.trim();
}


async function callGeminiGrammar(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    contents: [
      {
        parts: [{ text: buildPrompt(text) }]
      }
    ]
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[GrammarExt BG] Gemini error:", res.status, errText);
    throw new Error("Gemini API error: " + res.status);
  }

  const data = await res.json();

  const candidate = data.candidates && data.candidates[0];
  const parts = candidate && candidate.content && candidate.content.parts;

  if (!parts || !parts.length) {
    console.warn("[GrammarExt BG] Empty response from Gemini, using original.");
    return text;
  }

  const corrected = parts
    .map((p) => p.text || "")
    .join("")
    .trim();

  if (!corrected) {
    console.warn("[GrammarExt BG] Corrected empty, using original.");
    return text;
  }

  return corrected;
}


chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {

  if (!text || !text.trim()) return;

  try {
    const corrected = await callGeminiGrammar(text.trim());

    const html = `
      <html>
        <head>
          <title>Corrected Text</title>
          <meta charset="utf-8" />
          <style>
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              padding: 20px;
              max-width: 800px;
              margin: 0 auto;
              line-height: 1.5;
            }
            h1 {
              font-size: 20px;
              margin-bottom: 10px;
            }
            textarea {
              width: 100%;
              height: 200px;
              font-size: 14px;
              padding: 10px;
              box-sizing: border-box;
            }
            .label {
              font-weight: 600;
              margin-top: 15px;
            }
            pre {
              background: #f5f5f5;
              padding: 10px;
              border-radius: 4px;
              white-space: pre-wrap;
              word-wrap: break-word;
            }
          </style>
        </head>
        <body>
          <h1>Grammar Correction (Gemini)</h1>

          <div class="label">Original text:</div>
          <pre>${escapeHtml(text.trim())}</pre>

          <div class="label">Corrected text:</div>
          <textarea>${escapeHtml(corrected)}</textarea>

          <p>You can copy the corrected text above and paste it wherever you need.</p>
        </body>
      </html>
    `;

    const dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(html);
    chrome.tabs.create({ url: dataUrl });
  } catch (err) {
    console.error("[GrammarExt BG] Error correcting via omnibox:", err);
  }
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
