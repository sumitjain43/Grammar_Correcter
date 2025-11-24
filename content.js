const GEMINI_API_KEY = "AIzaSyB1bKWkQLN2-5ESctn5htWbUXO0t7O7bs4";
const GEMINI_MODEL = "gemini-2.5-flash";

const MODES = {
  OFF: "off",
  SUGGEST: "suggest",
  AUTO: "auto",
};

let currentMode = MODES.SUGGEST;
let currentEditable = null;

chrome.storage.sync.get(["mode"], (res) => {
  if (res.mode && Object.values(MODES).includes(res.mode)) {
    currentMode = res.mode;
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "UPDATE_MODE") {
    currentMode = msg.mode;
    sendResponse({ ok: true });
  }
});

document.addEventListener("focusin", (e) => {
  const el = e.target;
  if (isEditable(el)) {
    currentEditable = el;
    console.log(
      "[GrammarExt] Focused editable element:",
      el.tagName,
      el.type || "",
      el.isContentEditable
    );
  }
});

function isEditable(el) {
  if (!el) return false;

  if (el.tagName === "TEXTAREA") return true;

  if (el.tagName === "INPUT") {
    const badTypes = [
      "button",
      "submit",
      "checkbox",
      "radio",
      "file",
      "color",
      "range",
      "hidden",
      "image",
      "reset",
    ];
    return !badTypes.includes(el.type);
  }

  if (el.isContentEditable) return true;

  return false;
}

function getElementText(el) {
  if (!el) return "";
  if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
    return el.value;
  }
  if (el.isContentEditable) {
    return el.innerText;
  }
  return "";
}

function setElementText(el, text) {
  if (!el) return;
  if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
    el.value = text;
  } else if (el.isContentEditable) {
    el.innerText = text;
  }
}

function getSelectedText() {
  const sel = window.getSelection();
  if (!sel) return "";
  return sel.toString();
}

function replaceSelectionWith(text) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(document.createTextNode(text));

  sel.removeAllRanges();
  const newRange = document.createRange();
  newRange.selectNodeContents(range.startContainer);
  sel.addRange(newRange);
}

document.addEventListener("keydown", async (e) => {
  if (!e.altKey || e.key.toLowerCase() !== "g") return;

  console.log("[GrammarExt] Alt+G detected");

  if (currentMode === MODES.OFF) {
    console.log("[GrammarExt] Mode is OFF, doing nothing.");
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  let selectedText = getSelectedText().trim();
  let targetType = null;
  let originalText = "";

  if (selectedText) {
    targetType = "selection";
    originalText = selectedText;
    console.log("[GrammarExt] Using selected text:", originalText);
  } else if (currentEditable) {
    targetType = "field";
    originalText = getElementText(currentEditable).trim();
    console.log(
      "[GrammarExt] Using current editable field text:",
      originalText
    );
  } 
  else {
    return;
  }

  if (!originalText) {
    return;
  }

  try {
    const corrected = await grammarCheck(originalText);

    if (!corrected || corrected === originalText) {
      alert("No major grammar issues found.");
      return;
    }

    if (currentMode === MODES.SUGGEST) {
      const message =
        "Original:\n\n" +
        originalText +
        "\n\nCorrected:\n\n" +
        corrected +
        "\n\nApply correction?";
      const ok = confirm(message);
      if (!ok) return;

      if (targetType === "selection") {
        replaceSelectionWith(corrected);
      } 
      else if (targetType === "field") {
        setElementText(currentEditable, corrected);
      }
    } else if (currentMode === MODES.AUTO) {
      if (targetType === "selection") {
        replaceSelectionWith(corrected);
      } else if (targetType === "field") {
        setElementText(currentEditable, corrected);
      }
    }
  } catch (err) {
    alert("Error while checking grammar. Please try again.");
  }
});

async function grammarCheck(text) {

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const prompt = `
You are an assistant that corrects English grammar, spelling, and punctuation.
When I give you some text, respond with a corrected version that is natural and clear in English.
Keep the original meaning and tone as close as possible.
Do not add new ideas or remove any important information.
Do not explain the changes.
Return only the corrected text, with no extra words or formatting.

Text:
${text}
  `.trim();

  const body = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error("Gemini API error: " + res.status);
  }

  const data = await res.json();

  const candidate = data.candidates && data.candidates[0];
  const parts = candidate && candidate.content && candidate.content.parts;

  if (!parts || !parts.length) {
    console.warn(
      "[GrammarExt] Gemini returned empty response, using original text."
    );
    return text;
  }

  const corrected = parts
    .map((p) => p.text || "")
    .join("")
    .trim();

  if (!corrected) {
    console.warn("[GrammarExt] Corrected text empty, using original text.");
    return text;
  }
  return corrected;
}
