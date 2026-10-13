function readStorage(storage) {
  const values = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    values.push({ key, value: storage.getItem(key) });
  }

  return values;
}

function writeStorage(storage, values) {
  let written = 0;
  let skipped = 0;

  for (const item of values || []) {
    try {
      storage.setItem(item.key, item.value);
      written += 1;
    } catch {
      skipped += 1;
    }
  }

  return { written, skipped };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "COPY_BROWSER_VALUES") {
    try {
      sendResponse({
        ok: true,
        localStorage: readStorage(window.localStorage),
        sessionStorage: readStorage(window.sessionStorage)
      });
    } catch (error) {
      sendResponse({ ok: false, error: error.message });
    }
  }

  if (message.type === "PASTE_BROWSER_VALUES") {
    try {
      const local = writeStorage(window.localStorage, message.localStorage);
      const session = writeStorage(window.sessionStorage, message.sessionStorage);
      sendResponse({
        ok: true,
        written: local.written + session.written,
        skipped: local.skipped + session.skipped
      });
    } catch (error) {
      sendResponse({ ok: false, error: error.message });
    }
  }
});
