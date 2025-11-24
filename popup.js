document.addEventListener("DOMContentLoaded", () => {
  const radios = document.querySelectorAll('input[name="mode"]');

  chrome.storage.sync.get(["mode"], (res) => {
    const mode = res.mode || "suggest";
    const radio = document.querySelector(`input[value="${mode}"]`);
    if (radio) radio.checked = true;
  });

  radios.forEach((radio) => {
    radio.addEventListener("change", async (e) => {
      const mode = e.target.value;

      chrome.storage.sync.set({ mode });

     chrome.tabs.query({}, (tabs) => {
          for (const tab of tabs) {
            if (!tab.id) continue;
            chrome.tabs.sendMessage(
              tab.id,
              { type: "UPDATE_MODE", mode },
              () => {
                if (chrome.runtime.lastError) {
                 
                }
              }
            );
          }
        });
    });
  });
});