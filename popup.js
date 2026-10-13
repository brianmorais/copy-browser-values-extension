const copyButton = document.getElementById("copy");
const pasteButton = document.getElementById("paste");

function showResult(button, message) {
  const originalText = button.dataset.originalText || button.textContent;
  button.dataset.originalText = originalText;
  button.textContent = message;
  window.setTimeout(() => {
    button.textContent = originalText;
  }, 1800);
}

function withActiveTab(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (chrome.runtime.lastError || !tabs[0]) {
      callback(null);
      return;
    }

    callback(tabs[0]);
  });
}

copyButton.addEventListener("click", () => {
  withActiveTab(tab => {
    if (!tab) {
      showResult(copyButton, "Unavailable");
      return;
    }

    chrome.tabs.sendMessage(tab.id, { type: "COPY_BROWSER_VALUES" }, response => {
      if (chrome.runtime.lastError || !response || !response.ok) {
        showResult(copyButton, "Copy failed");
        return;
      }

      chrome.cookies.getAll({ url: tab.url }, cookies => {
        if (chrome.runtime.lastError) {
          showResult(copyButton, "Copy failed");
          return;
        }

        const copiedBrowserValues = {
          version: 1,
          localStorage: response.localStorage,
          sessionStorage: response.sessionStorage,
          cookies: cookies.map(cookie => ({
            name: cookie.name,
            value: cookie.value,
            path: cookie.path,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            sameSite: cookie.sameSite,
            expirationDate: cookie.expirationDate
          })),
          sourceUrl: tab.url,
          copiedAt: Date.now()
        };

        navigator.clipboard.writeText(JSON.stringify(copiedBrowserValues))
          .then(() => {
            const valueCount = response.localStorage.length + response.sessionStorage.length + cookies.length;
            showResult(copyButton, valueCount ? "Copied!" : "No values");
          })
          .catch(() => showResult(copyButton, "Clipboard failed"));
      });
    });
  });
});

pasteButton.addEventListener("click", () => {
  navigator.clipboard.readText().then(text => {
    let copiedValues;

    try {
      copiedValues = JSON.parse(text);
    } catch {
      showResult(pasteButton, "Invalid clipboard");
      return;
    }

    if (
      copiedValues.version !== 1 ||
      !Array.isArray(copiedValues.localStorage) ||
      !Array.isArray(copiedValues.sessionStorage) ||
      !Array.isArray(copiedValues.cookies)
    ) {
      showResult(pasteButton, "Invalid clipboard");
      return;
    }

    withActiveTab(tab => {
      if (!tab) {
        showResult(pasteButton, "Unavailable");
        return;
      }

      chrome.tabs.sendMessage(tab.id, {
        type: "PASTE_BROWSER_VALUES",
        localStorage: copiedValues.localStorage,
        sessionStorage: copiedValues.sessionStorage
      }, response => {
        if (chrome.runtime.lastError || !response || !response.ok) {
          showResult(pasteButton, "Paste failed");
          return;
        }

        pasteCookies(copiedValues.cookies, tab.url, response.written);
      });
    });
  }).catch(() => showResult(pasteButton, "Clipboard failed"));
});

function pasteCookies(cookies, targetUrl, storageCount) {
  const target = new URL(targetUrl);
  let remaining = cookies.length;
  let pasted = storageCount;

  if (!remaining) {
    showResult(pasteButton, `Pasted ${pasted}`);
    return;
  }

  for (const cookie of cookies) {
    const details = {
      url: target.origin,
      name: cookie.name,
      value: cookie.value,
      path: cookie.path,
      secure: cookie.secure && target.protocol === "https:",
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite
    };

    if (cookie.expirationDate) details.expirationDate = cookie.expirationDate;

    chrome.cookies.set(details, result => {
      if (!chrome.runtime.lastError && result) pasted += 1;
      remaining -= 1;

      if (!remaining) showResult(pasteButton, `Pasted ${pasted}`);
    });
  }
}
