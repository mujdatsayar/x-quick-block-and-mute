# X.com Quick Block, Account & Keyword Mute (All-in-One)

A lightweight Tampermonkey / Violentmonkey userscript that turns **account blocking**, **account muting**, and **single/multi-word keyword muting** on X (formerly Twitter) into one-click actions.

> **Key Difference:** This script does not merely hide posts locally in your browser. Every action is **saved directly to your official X account settings** (`Blocked accounts`, `Muted accounts`, and `Muted words`), so your filters sync permanently across all your devices, including the mobile app.

---

## Why It's Useful

On native X:
- Muting a **keyword** requires: *More → Settings and privacy → Privacy and safety → Mute and block → Muted words → Add → Type word → Choose duration/options → Save* (7–8 steps).
- Blocking an **account** requires: *Three dots (`...`) → Block → Confirm* (3 steps, easy to misclick).

With this userscript:
- **Keyword muting:** Simply **highlight a word or phrase with your mouse** inside any post and click the floating popover. It is immediately saved to `x.com/settings/muted_keywords`.
- **Account blocking / muting:** **Click any username or handle** in your timeline to open a clean quick-action modal with **Go to Profile**, **Mute Account**, and **Block Account**.

---

## Features

- **Single & Multi-Word Keyword Muting:**
  - **Single word selection:** Adds the highlighted word directly to X's *Muted words* settings in one click.
  - **Multi-word selection:** Gives you two options in the floating popover:
    1. *Mute phrase* (saves the entire selected phrase as one rule)
    2. *Select words* (splits the selection into toggleable word chips so you can check multiple words, add extra comma-separated keywords, configure mute duration & *"Exclude followed accounts"*, and save them all to X settings at once)
  - **Bulk Keyword Menu:** Click the Tampermonkey extension icon → *"Bulk Mute Keywords (Save to X Settings)"* to mute comma-separated keywords anytime without selecting text first.
- **Quick Account Actions (Profile / Mute / Block):**
  - Uses X's native UI flow and official API endpoints (`/1.1/blocks/create.json`, `/1.1/mutes/users/create.json`).
  - Includes an **Undo** button in the confirmation toast in case of an accidental mute or block.
  - **Quote Tweet Protection:** Clicking the author of a quoted post accurately targets the quoted account instead of the outer post author.
  - **Self-Account Guard:** Hides mute/block buttons when you click your own username.
  - **Instant SPA Navigation:** Clicking *Go to Profile* uses X's built-in client router without a full page reload.
- **Smart Feed Cleanup & Auto Theme Sync:**
  - Safely hides matching posts in a React-virtualizer-friendly way (without breaking DOM recycling) and continues hiding newly loaded matching posts as you scroll.
  - Automatically adapts to X's **Light**, **Dim**, and **Lights Out** themes.
- **Update-Resilient Dynamic Engine:**
  - Avoids hardcoded Webpack module IDs; dynamically discovers X's `x-client-transaction-id` generator and Redux store at runtime.

---

## Installation

1. Install **[Tampermonkey](https://www.tampermonkey.net/)** (Chrome, Edge, Brave, Firefox) or **Violentmonkey** in your browser.
2. For one-click installation, **[Click Here (x-quick-block-and-mute.user.js)](https://raw.githubusercontent.com/mujdatsayar/x-quick-block-and-mute/main/x-quick-block-and-mute.user.js)** — Tampermonkey will automatically open the installation prompt.
   *(Alternatively, open [`x-quick-block-and-mute.user.js`](./x-quick-block-and-mute.user.js), copy its contents into a new script in the Tampermonkey Dashboard, and press `Ctrl + S`.)*
3. If you already have `https://x.com/` open, refresh the tab (`F5`).

---

## How to Use

| Action | How to Do It | Saved In X Settings |
| :--- | :--- | :--- |
| **Mute a single word** | Highlight a word in a post → click the floating button | `x.com/settings/muted_keywords` |
| **Mute multiple words** | Highlight a phrase → click **Select words** → toggle chips & save | `x.com/settings/muted_keywords` |
| **Bulk add keywords** | Click Tampermonkey icon → *Bulk Mute Keywords* | `x.com/settings/muted_keywords` |
| **Block / Mute account** | Click any username in the feed → *Mute Account* or *Block Account* | `x.com/settings/muted/all` / `x.com/settings/blocked/all` |
| **Open profile directly** | `Ctrl + Click` (or click *Go to Profile* in the modal) | — |

> **Tip:** Clicking the timestamp link next to a username (`· 2h`) still opens the post details normally; the quick modal only triggers when clicking the display name or `@handle`.

---

## Privacy & Security

- Runs **100% locally inside your browser**; never sends data to any external server, third-party API, or analytics service.
- All requests go directly through your own authenticated browser session (`x.com` / `api.x.com`) using X's native CSRF (`ct0`) and `x-client-transaction-id` headers.
- All UI elements are built with safe DOM APIs (`createElement` / `textContent`) rather than `innerHTML` for `TrustedHTML` / XSS compliance.

---

## License

[MIT](./LICENSE)
