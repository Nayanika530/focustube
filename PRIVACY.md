# Privacy & Data Policy - FocusTube

FocusTube is designed with an on-device architecture. This document details the permissions requested, data handled, and network behavior of the extension.

---

## 1. Permissions Requested & Justification

FocusTube requests only the minimum permissions required to provide distraction blocking on YouTube:

| Permission | Manifest Field | Technical Justification |
| :--- | :--- | :--- |
| **Storage** | `"storage"` | Used exclusively via `chrome.storage.local` to persist the student's active exam subjects, mode toggles (e.g., Strict Mode, Block Shorts), and local distraction counter across browser restarts. |
| **Host Permissions** | `https://www.youtube.com/*`<br/>`https://youtube.com/*` | Required to inject the content script (`content.js`) onto YouTube video and Shorts pages to inspect video titles and mount the Focus Shield overlay. FocusTube has no access to any other domain. |

---

## 2. Data Storage & Telemetry

* **Local Storage Only:** All configuration (study topics, toggles, blocked counter) is stored locally on your machine in sandboxed browser storage (`chrome.storage.local`).
* **Zero Remote Analytics:** FocusTube contains no analytics SDKs (no Google Analytics, Mixpanel, Sentry, or third-party trackers).
* **Zero Outbound Telemetry:** The extension makes no network requests (`fetch`, `XMLHttpRequest`, or WebSockets) to any remote server or API. Video relevance classification is computed entirely within the client's content script runtime.
* **No Account Required:** FocusTube operates immediately upon installation without requiring user registration, email addresses, or sign-in tokens.
* **Browsing History:** FocusTube inspects metadata (video title, channel name) only within active YouTube tabs to determine study relevance. Browsing history is never stored, indexed, or exported.

---

## 3. Open Source Verification

Because FocusTube is distributed as an open-source extension, all source code is unminified and fully auditable:
* Extension Manifest: [`extension/manifest.json`](extension/manifest.json)
* Content Script: [`extension/content.js`](extension/content.js)
* Popup Controller: [`extension/popup.js`](extension/popup.js)

---

## 4. Updates & Changes

Any future updates to permissions or architectural changes will be documented transparently in this repository.
