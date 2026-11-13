// ==UserScript==
// @name         X.com Hızlı Engelleme, Hesap ve Kelime Sessize Alma (Hepsi Bir Arada)
// @namespace    https://github.com/mujdatsayar/x-quick-block-and-mute
// @version      4.0.1
// @description  X.com'da kullanıcı adına tıklayınca Profil / Sessize Al / Engelle sunar; tek veya çoklu seçilen kelimeleri doğrudan X ayarlarındaki (Sessize Alınan Kelimeler / Hesaplar / Engellenenler) listesine kaydeder.
// @author       Antigravity
// @homepageURL  https://github.com/mujdatsayar/x-quick-block-and-mute
// @supportURL   https://github.com/mujdatsayar/x-quick-block-and-mute/issues
// @updateURL    https://raw.githubusercontent.com/mujdatsayar/x-quick-block-and-mute/main/x-quick-block-and-mute.user.js
// @downloadURL  https://raw.githubusercontent.com/mujdatsayar/x-quick-block-and-mute/main/x-quick-block-and-mute.user.js
// @match        https://x.com/*
// @match        https://twitter.com/*
// @icon         https://abs.twimg.com/favicons/twitter.3.ico
// @grant        unsafeWindow
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const DEFAULT_BEARER =
    'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

  // =========================================================================
  // 0. AYARLAR & ÇALIŞMA ZAMANI DURUMU
  // =========================================================================
  const SETTINGS_KEY = 'xqb_settings_v4';
  const DEFAULT_SETTINGS = {
    muteDurationMs: '', // '' = Sonsuz, '86400000' = 24 saat, '604800000' = 7 gün, '2592000000' = 30 gün
    excludeFollowing: true,
    muteSurfaces: 'notifications,home_timeline,tweet_replies',
    hideLocallyAfterApi: true
  };

  function getSettings() {
    try {
      const saved = typeof GM_getValue === 'function' ? GM_getValue(SETTINGS_KEY, null) : null;
      return saved ? { ...DEFAULT_SETTINGS, ...saved } : { ...DEFAULT_SETTINGS };
    } catch (_) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(next) {
    try {
      if (typeof GM_setValue === 'function') {
        GM_setValue(SETTINGS_KEY, next);
      }
    } catch (_) {}
  }

  // Oturum içinde gizlenen öğeler (sayfa içi MutationObserver desteği)
  const sessionMutedKeywords = new Set();
  const sessionHiddenHandles = new Set();
  let capturedBearer = DEFAULT_BEARER;

  // X'in kendi gönderdiği Authorization Bearer token'ını dinamik yakala (fetch + XHR)
  try {
    const origFetch = win.fetch;
    if (typeof origFetch === 'function') {
      win.fetch = function (input, init) {
        try {
          const hdrs = init && init.headers;
          if (hdrs) {
            let auth = '';
            if (typeof hdrs.get === 'function') {
              auth = hdrs.get('authorization') || hdrs.get('Authorization') || '';
            } else if (typeof hdrs === 'object') {
              auth = hdrs.authorization || hdrs.Authorization || '';
            }
            if (auth && auth.startsWith('Bearer ')) {
              capturedBearer = auth;
            }
          }
        } catch (_) {}
        return origFetch.apply(this, arguments);
      };
    }

    const XHRProto = win.XMLHttpRequest && win.XMLHttpRequest.prototype;
    if (XHRProto && typeof XHRProto.setRequestHeader === 'function') {
      const origSetHeader = XHRProto.setRequestHeader;
      XHRProto.setRequestHeader = function (name, value) {
        try {
          if (
            typeof name === 'string' &&
            name.toLowerCase() === 'authorization' &&
            typeof value === 'string' &&
            value.startsWith('Bearer ')
          ) {
            capturedBearer = value;
          }
        } catch (_) {}
        return origSetHeader.apply(this, arguments);
      };
    }
  } catch (_) {}

  // =========================================================================
  // 1. CSS & STİL TANIMLARI (Light / Dim / Lights Out Tema Uyumlu)
  // =========================================================================
  const CSS = `
    :root {
      --xqb-bg: #000000;
      --xqb-bg-hover: #16181c;
      --xqb-surface: #16181c;
      --xqb-border: #2f3336;
      --xqb-text: #e7e9ea;
      --xqb-muted: #71767b;
      --xqb-primary-bg: #eff3f4;
      --xqb-primary-text: #0f1419;
      --xqb-primary-hover: #d7dbdc;
      --xqb-accent: #1d9bf0;
      --xqb-danger: #f4212e;
      --xqb-warn: #ffd400;
    }

    @keyframes xqb-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .xqb-spinner {
      animation: xqb-spin 0.8s linear infinite;
    }

    .xqb-overlay {
      position: fixed;
      inset: 0;
      background: rgba(91, 112, 131, 0.4);
      backdrop-filter: blur(4px);
      z-index: 2147483646;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .xqb-overlay.xqb-visible {
      opacity: 1;
    }

    .xqb-modal {
      background: var(--xqb-bg);
      border: 1px solid var(--xqb-border);
      border-radius: 18px;
      width: 92%;
      max-width: 390px;
      padding: 22px 24px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.65);
      transform: scale(0.94) translateY(8px);
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      color: var(--xqb-text);
      position: relative;
      box-sizing: border-box;
    }
    .xqb-overlay.xqb-visible .xqb-modal {
      transform: scale(1) translateY(0);
    }

    .xqb-close-btn {
      position: absolute;
      top: 14px;
      right: 14px;
      background: transparent;
      border: none;
      color: var(--xqb-muted);
      cursor: pointer;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.18s, color 0.18s;
    }
    .xqb-close-btn:hover {
      background: rgba(113, 118, 123, 0.18);
      color: var(--xqb-text);
    }

    .xqb-header {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 18px;
      padding-right: 30px;
    }
    .xqb-avatar {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      object-fit: cover;
      background: var(--xqb-border);
      flex-shrink: 0;
    }
    .xqb-user-info {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .xqb-display-name {
      font-weight: 800;
      font-size: 16px;
      color: var(--xqb-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .xqb-username {
      font-size: 14px;
      color: var(--xqb-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 2px;
    }

    .xqb-actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .xqb-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 9px;
      width: 100%;
      padding: 11px 16px;
      border-radius: 9999px;
      font-size: 14.5px;
      font-weight: 700;
      cursor: pointer;
      border: 1px solid transparent;
      transition: background 0.15s, transform 0.1s, opacity 0.15s, border-color 0.15s;
      outline: none;
      box-sizing: border-box;
    }
    .xqb-btn:active {
      transform: scale(0.98);
    }
    .xqb-btn:focus-visible {
      box-shadow: 0 0 0 2px var(--xqb-accent);
    }

    .xqb-btn-profile {
      background: var(--xqb-primary-bg);
      color: var(--xqb-primary-text);
    }
    .xqb-btn-profile:hover {
      background: var(--xqb-primary-hover);
    }

    .xqb-btn-mute {
      background: transparent;
      color: var(--xqb-text);
      border-color: var(--xqb-border);
    }
    .xqb-btn-mute:hover {
      background: rgba(29, 155, 240, 0.12);
      border-color: var(--xqb-accent);
      color: var(--xqb-accent);
    }

    .xqb-btn-block {
      background: var(--xqb-danger);
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(244, 33, 46, 0.3);
    }
    .xqb-btn-block:hover {
      background: #dc1e29;
    }

    .xqb-btn-loading {
      opacity: 0.7;
      pointer-events: none;
    }

    .xqb-hint {
      margin-top: 12px;
      font-size: 11.5px;
      color: var(--xqb-muted);
      text-align: center;
    }

    /* === METİN SEÇİMİ POPOVER === */
    .xqb-popover {
      position: fixed !important;
      z-index: 2147483647 !important;
      background: var(--xqb-bg) !important;
      border: 1px solid var(--xqb-border) !important;
      border-radius: 9999px !important;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.75) !important;
      padding: 4px !important;
      display: flex !important;
      align-items: center !important;
      gap: 4px !important;
      color: var(--xqb-text) !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
      font-size: 12.5px !important;
      font-weight: 700 !important;
      transition: opacity 0.16s cubic-bezier(0.16, 1, 0.3, 1), transform 0.16s cubic-bezier(0.16, 1, 0.3, 1) !important;
      transform: translateY(6px) scale(0.95) !important;
      opacity: 0 !important;
      pointer-events: none !important;
      user-select: none !important;
      white-space: nowrap !important;
      max-width: 92vw !important;
    }
    .xqb-popover.xqb-popover-show {
      transform: translateY(0) scale(1) !important;
      opacity: 1 !important;
      pointer-events: auto !important;
    }
    .xqb-popover-btn {
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      background: transparent !important;
      border: none !important;
      border-radius: 9999px !important;
      padding: 6px 12px !important;
      color: var(--xqb-text) !important;
      font-family: inherit !important;
      font-size: 12.5px !important;
      font-weight: 700 !important;
      cursor: pointer !important;
      transition: background 0.14s, color 0.14s !important;
    }
    .xqb-popover-btn:hover {
      background: var(--xqb-bg-hover) !important;
      color: #ffffff !important;
    }
    .xqb-popover-btn-secondary {
      color: var(--xqb-accent) !important;
      border-left: 1px solid var(--xqb-border) !important;
      border-radius: 0 9999px 9999px 0 !important;
    }
    .xqb-popover-btn svg {
      color: var(--xqb-danger) !important;
      flex-shrink: 0 !important;
    }
    .xqb-popover-btn-secondary svg {
      color: var(--xqb-accent) !important;
    }
    .xqb-popover-label {
      max-width: 210px !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }

    /* === ÇOKLU KELİME SEÇİM MODALI === */
    .xqb-modal-wide {
      max-width: 440px;
    }
    .xqb-modal-title {
      font-size: 17px;
      font-weight: 800;
      margin: 0 0 6px 0;
      padding-right: 28px;
      color: var(--xqb-text);
    }
    .xqb-modal-desc {
      font-size: 13px;
      color: var(--xqb-muted);
      margin: 0 0 14px 0;
      line-height: 1.4;
    }
    .xqb-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      max-height: 165px;
      overflow-y: auto;
      padding: 4px 0 12px 0;
    }
    .xqb-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      border: 1px solid var(--xqb-border);
      background: var(--xqb-surface);
      color: var(--xqb-muted);
      cursor: pointer;
      transition: all 0.14s;
    }
    .xqb-chip.xqb-chip-active {
      border-color: var(--xqb-accent);
      background: rgba(29, 155, 240, 0.15);
      color: var(--xqb-text);
    }
    .xqb-input-row {
      display: flex;
      gap: 8px;
      margin-bottom: 14px;
    }
    .xqb-input {
      flex: 1;
      background: var(--xqb-surface);
      border: 1px solid var(--xqb-border);
      border-radius: 10px;
      padding: 9px 12px;
      color: var(--xqb-text);
      font-size: 13.5px;
      outline: none;
    }
    .xqb-input:focus {
      border-color: var(--xqb-accent);
    }
    .xqb-options-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 16px;
      font-size: 12.5px;
      color: var(--xqb-text);
    }
    .xqb-select {
      width: 100%;
      background: var(--xqb-surface);
      border: 1px solid var(--xqb-border);
      border-radius: 10px;
      padding: 8px 10px;
      color: var(--xqb-text);
      font-size: 13px;
    }
    .xqb-checkbox-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--xqb-surface);
      border: 1px solid var(--xqb-border);
      border-radius: 10px;
      padding: 8px 10px;
      cursor: pointer;
    }

    /* === BİLDİRİM TOAST === */
    .xqb-toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(40px);
      background: var(--xqb-accent);
      color: #ffffff;
      font-size: 13.5px;
      font-weight: 600;
      padding: 11px 18px;
      border-radius: 9999px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.55);
      z-index: 2147483647;
      opacity: 0;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: none;
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      max-width: 90vw;
    }
    .xqb-toast.xqb-toast-show {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
      pointer-events: auto;
    }
    .xqb-toast.xqb-toast-danger {
      background: var(--xqb-danger);
    }
    .xqb-toast-undo {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      border-radius: 9999px;
      color: #ffffff;
      font-weight: 800;
      font-size: 12px;
      padding: 4px 10px;
      cursor: pointer;
    }
    .xqb-toast-undo:hover {
      background: rgba(255, 255, 255, 0.32);
    }

    /* Gizli DOM İşlemleri için Görünmez Katman */
    .xqb-stealth-active [data-testid="Dropdown"],
    .xqb-stealth-active div[role="dialog"]:has([data-testid="confirmationSheetConfirm"]) {
      opacity: 0 !important;
      pointer-events: none !important;
    }
  `;

  function injectStyles() {
    try {
      if (typeof GM_addStyle === 'function') {
        GM_addStyle(CSS);
        return;
      }
    } catch (_) {}
    const attach = () => {
      if (!document.head) return false;
      const el = document.createElement('style');
      el.textContent = CSS;
      document.head.appendChild(el);
      return true;
    };
    if (!attach()) {
      document.addEventListener('DOMContentLoaded', attach, { once: true });
    }
  }

  function syncThemeWithX() {
    if (!document.body) return;
    const bg = getComputedStyle(document.body).backgroundColor;
    const root = document.documentElement;
    if (bg === 'rgb(255, 255, 255)') {
      root.style.setProperty('--xqb-bg', '#ffffff');
      root.style.setProperty('--xqb-bg-hover', '#f7f9f9');
      root.style.setProperty('--xqb-surface', '#eff3f4');
      root.style.setProperty('--xqb-border', '#eff3f4');
      root.style.setProperty('--xqb-text', '#0f1419');
      root.style.setProperty('--xqb-muted', '#536471');
      root.style.setProperty('--xqb-primary-bg', '#0f1419');
      root.style.setProperty('--xqb-primary-text', '#ffffff');
      root.style.setProperty('--xqb-primary-hover', '#272c30');
    } else if (bg === 'rgb(21, 32, 43)') {
      root.style.setProperty('--xqb-bg', '#15202b');
      root.style.setProperty('--xqb-bg-hover', '#1e2732');
      root.style.setProperty('--xqb-surface', '#1e2732');
      root.style.setProperty('--xqb-border', '#38444d');
      root.style.setProperty('--xqb-text', '#f7f9f9');
      root.style.setProperty('--xqb-muted', '#8b98a5');
      root.style.setProperty('--xqb-primary-bg', '#eff3f4');
      root.style.setProperty('--xqb-primary-text', '#0f1419');
      root.style.setProperty('--xqb-primary-hover', '#d7dbdc');
    } else {
      root.style.setProperty('--xqb-bg', '#000000');
      root.style.setProperty('--xqb-bg-hover', '#16181c');
      root.style.setProperty('--xqb-surface', '#16181c');
      root.style.setProperty('--xqb-border', '#2f3336');
      root.style.setProperty('--xqb-text', '#e7e9ea');
      root.style.setProperty('--xqb-muted', '#71767b');
      root.style.setProperty('--xqb-primary-bg', '#eff3f4');
      root.style.setProperty('--xqb-primary-text', '#0f1419');
      root.style.setProperty('--xqb-primary-hover', '#d7dbdc');
    }
  }

  // =========================================================================
  // 2. GÜVENLİ DOM & SVG YARDIMCILARI (TrustedHTML / XSS Uyumlu)
  // =========================================================================
  function createSvgIcon(pathD, size = 18, strokeOnly = false) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('viewBox', '0 0 24 24');
    if (strokeOnly) {
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2.5');
      svg.setAttribute('class', 'xqb-spinner');
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '12');
      circle.setAttribute('cy', '12');
      circle.setAttribute('r', '10');
      circle.setAttribute('stroke-opacity', '0.25');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathD);
      path.setAttribute('stroke-linecap', 'round');
      svg.append(circle, path);
    } else {
      svg.setAttribute('fill', 'currentColor');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathD);
      svg.appendChild(path);
    }
    return svg;
  }

  const ICONS = {
    close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
    profile: 'M12 4a4 4 0 100 8 4 4 0 000-8zM6 8a6 6 0 1112 0A6 6 0 016 8zm2 10a3 3 0 00-3 3 1 1 0 11-2 0 5 5 0 015-5h8a5 5 0 015 5 1 1 0 11-2 0 3 3 0 00-3-3H8z',
    mute: 'M18 6.59V1.2L8.71 7H5.5C4.12 7 3 8.12 3 9.5v5C3 15.88 4.12 17 5.5 17h2.09l-2.3 2.29 1.42 1.42 15.5-15.5-1.42-1.42L18 6.59zm-8 8V8.55l6-3.75v3.79l-6 6zM5 9.5c0-.28.22-.5.5-.5H8v6H5.5c-.28 0-.5-.22-.5-.5v-5zm6.5 9.24l1.45-1.45L16 19.2V14l2-2v9.28c0 .9-.99 1.44-1.73.94l-4.77-3.48z',
    block: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z',
    check: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
    list: 'M3 5h18v2H3V5zm0 6h12v2H3v-2zm0 6h18v2H3v-2z',
    spinner: 'M12 2a10 10 0 0110 10'
  };

  let activeToastTimer = null;
  function showToast(message, options = {}) {
    const { isDanger = false, undoLabel = '', onUndo = null, durationMs = 4200 } = options;
    document.querySelectorAll('.xqb-toast').forEach((el) => el.remove());
    clearTimeout(activeToastTimer);

    const toast = document.createElement('div');
    toast.className = `xqb-toast${isDanger ? ' xqb-toast-danger' : ''}`;
    toast.appendChild(createSvgIcon(ICONS.check, 18));

    const span = document.createElement('span');
    span.textContent = message;
    toast.appendChild(span);

    if (undoLabel && typeof onUndo === 'function') {
      const undoBtn = document.createElement('button');
      undoBtn.type = 'button';
      undoBtn.className = 'xqb-toast-undo';
      undoBtn.textContent = undoLabel;
      undoBtn.addEventListener('click', async () => {
        undoBtn.disabled = true;
        undoBtn.textContent = 'Geri alınıyor...';
        await onUndo();
        toast.classList.remove('xqb-toast-show');
        setTimeout(() => toast.remove(), 250);
      });
      toast.appendChild(undoBtn);
    }

    (document.body || document.documentElement).appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('xqb-toast-show'));

    activeToastTimer = setTimeout(() => {
      toast.classList.remove('xqb-toast-show');
      setTimeout(() => toast.remove(), 300);
    }, durationMs);
  }

  function getCookie(name) {
    const value = `; ${win.document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return '';
  }

  function waitForElement(selector, timeoutMs = 1500, root = document) {
    return new Promise((resolve) => {
      const existing = root.querySelector(selector);
      if (existing) return resolve(existing);

      let done = false;
      const finish = (val) => {
        if (done) return;
        done = true;
        observer.disconnect();
        clearTimeout(timer);
        resolve(val);
      };

      const observer = new MutationObserver(() => {
        const el = root.querySelector(selector);
        if (el) finish(el);
      });
      observer.observe(root.body || root.documentElement || root, { childList: true, subtree: true });

      const timer = setTimeout(() => finish(root.querySelector(selector)), timeoutMs);
    });
  }

  // =========================================================================
  // 3. DİNAMİK X.COM WEBPACK, REDUX & RESMİ API MOTORU (Sürüm Bağımsız)
  // =========================================================================
  let cachedWpRequire = null;
  let cachedTidFn = null;
  let cachedMuteThunk = null;

  function getWebpackRequire() {
    if (cachedWpRequire) return cachedWpRequire;
    try {
      const chunks = win.webpackChunk_twitter_responsive_web;
      if (Array.isArray(chunks)) {
        chunks.push([
          ['xqb_req_' + Date.now()],
          {},
          (req) => {
            cachedWpRequire = req;
          }
        ]);
      }
    } catch (e) {
      console.warn('[XQB] Webpack erişim hatası:', e);
    }
    return cachedWpRequire;
  }

  // Sabit ID olmadan x-client-transaction-id üreten modülü dinamik bul
  async function generateTransactionId(path, method = 'POST') {
    const wpReq = getWebpackRequire();
    if (!wpReq || !wpReq.m) return '';

    const tryFn = async (fn) => {
      if (typeof fn !== 'function') return '';
      const attempts =
        fn.length >= 3
          ? [() => fn(win.location.host || 'x.com', path, method)]
          : fn.length === 2
            ? [() => fn(method, path), () => fn(path, method)]
            : [
                () => fn(win.location.host || 'x.com', path, method),
                () => fn(method, path),
                () => fn(path, method)
              ];

      for (const invoke of attempts) {
        try {
          const res = await invoke();
          if (typeof res === 'string' && res.length >= 16 && !res.includes(' ')) {
            return res;
          }
        } catch (_) {}
      }
      return '';
    };

    if (cachedTidFn) {
      const tid = await tryFn(cachedTidFn);
      if (tid) return tid;
      cachedTidFn = null;
    }

    const prioritySigs = ['rweb_client_transaction_id_enabled'];
    const signatures = [
      'rweb_client_transaction_id_enabled',
      'twitter-site-verification',
      'loading-x-anim',
      'ondemand.s',
      'x-client-transaction-id'
    ];
    const moduleIds = Object.keys(wpReq.m);
    const orderedIds = [
      ...moduleIds.filter((id) => {
        try { return prioritySigs.some((s) => wpReq.m[id].toString().includes(s)); } catch (_) { return false; }
      }),
      ...moduleIds
    ];

    for (const id of orderedIds) {
      let src = '';
      try {
        src = wpReq.m[id].toString();
      } catch (_) {
        continue;
      }
      if (!signatures.some((sig) => src.includes(sig))) continue;
      if (src.includes('XMLHttpRequest') || src.includes('fetch(')) continue;

      let mod;
      try {
        mod = wpReq(id);
      } catch (_) {
        continue;
      }
      if (!mod) continue;

      if (typeof mod === 'function') {
        const testTid = await tryFn(mod);
        if (testTid) {
          cachedTidFn = mod;
          return testTid;
        }
      } else if (typeof mod === 'object') {
        for (const expKey of Object.keys(mod)) {
          const candidate = mod[expKey];
          if (typeof candidate !== 'function') continue;
          const testTid = await tryFn(candidate);
          if (testTid) {
            cachedTidFn = candidate;
            return testTid;
          }
        }
      }
    }

    return '';
  }

  function findReduxStore() {
    const startNodes = [
      win.document.querySelector('#react-root > div'),
      win.document.querySelector('#react-root'),
      win.document.querySelector('[data-testid="primaryColumn"]')
    ].filter(Boolean);

    const isStore = (obj) =>
      obj && typeof obj.getState === 'function' && typeof obj.dispatch === 'function';

    const visited = new Set();
    const queue = [];

    for (const el of startNodes) {
      const fKey = Object.keys(el).find(
        (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactContainer$')
      );
      if (fKey && el[fKey]) {
        // Önce yukarı çık (Provider üsttedir)
        let up = el[fKey];
        while (up) {
          if (isStore(up.memoizedProps?.store)) return up.memoizedProps.store;
          if (isStore(up.memoizedProps?.value?.store)) return up.memoizedProps.value.store;
          if (isStore(up.memoizedProps?.value)) return up.memoizedProps.value;
          if (isStore(up.stateNode?.store)) return up.stateNode.store;
          if (isStore(up.memoizedState?.memoizedState)) return up.memoizedState.memoizedState;
          up = up.return;
        }
        queue.push(el[fKey]);
      }
    }

    // Bulunamadıysa sınırlı BFS ile alt düğümlerde ara
    let steps = 0;
    while (queue.length && steps < 400) {
      const node = queue.shift();
      if (!node || visited.has(node)) continue;
      visited.add(node);
      steps++;

      if (isStore(node.memoizedProps?.store)) return node.memoizedProps.store;
      if (isStore(node.memoizedProps?.value?.store)) return node.memoizedProps.value.store;
      if (isStore(node.memoizedProps?.value)) return node.memoizedProps.value;
      if (isStore(node.stateNode?.store)) return node.stateNode.store;
      if (isStore(node.memoizedState?.memoizedState)) return node.memoizedState.memoizedState;

      if (node.child) queue.push(node.child);
      if (node.sibling) queue.push(node.sibling);
    }

    return null;
  }

  function findMuteKeywordThunk() {
    if (cachedMuteThunk) return cachedMuteThunk;
    const wpReq = getWebpackRequire();
    if (!wpReq || !wpReq.m) return null;

    for (const id of Object.keys(wpReq.m)) {
      let src = '';
      try {
        src = wpReq.m[id].toString();
      } catch (_) {
        continue;
      }
      if (!src.includes('mutes/keywords/create') && !src.includes('mute_surfaces')) continue;

      try {
        const mod = wpReq(id);
        if (!mod || typeof mod !== 'object') continue;
        for (const k of Object.keys(mod)) {
          const fn = mod[k];
          if (typeof fn === 'function' && fn.toString().includes('mute_surfaces')) {
            cachedMuteThunk = fn;
            return fn;
          }
        }
      } catch (_) {}
    }
    return null;
  }

  function getUserIdFromStore(screenName) {
    try {
      const store = findReduxStore();
      if (!store) return '';
      const users = store.getState()?.entities?.users?.entities || {};
      const target = screenName.replace(/^@/, '').toLowerCase();
      for (const id of Object.keys(users)) {
        if (users[id]?.screen_name?.toLowerCase() === target) {
          return id;
        }
      }
    } catch (_) {}
    return '';
  }

  function getLoggedInUsername() {
    try {
      const profileLink = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');
      if (profileLink) {
        const href = profileLink.getAttribute('href') || '';
        const clean = href.replace(/^\//, '').split('/')[0];
        if (clean) return clean.toLowerCase();
      }
      const store = findReduxStore();
      const state = store?.getState?.();
      const myId = state?.session?.user_id;
      const myName = myId && state?.entities?.users?.entities?.[myId]?.screen_name;
      if (myName) return myName.toLowerCase();
    } catch (_) {}
    return '';
  }

  async function callXApi(endpointPath, paramsObj) {
    const ct0 = getCookie('ct0');
    if (!ct0) {
      return { ok: false, status: 0, error: 'CSRF token (ct0) bulunamadı. Oturum açık mı?' };
    }

    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(paramsObj)) {
      if (v !== undefined && v !== null) {
        body.append(k, String(v));
      }
    }

    const sendToBase = async (baseUrl, signPath) => {
      const tid = await generateTransactionId(signPath, 'POST');
      const headers = {
        authorization: capturedBearer || DEFAULT_BEARER,
        'x-csrf-token': ct0,
        'x-twitter-auth-type': 'OAuth2Session',
        'x-twitter-active-user': 'yes',
        'content-type': 'application/x-www-form-urlencoded'
      };
      if (tid) headers['x-client-transaction-id'] = tid;

      const res = await win.fetch(`${baseUrl}${signPath}`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: body.toString()
      });

      const data = await res.json().catch(() => null);
      if (res.ok) {
        return { ok: true, status: res.status, data };
      }

      const errCode = data?.errors?.[0]?.code;
      const errMsg = data?.errors?.[0]?.message || `HTTP ${res.status}`;
      if (res.status === 400 && errCode === 85) {
        return { ok: true, alreadyExists: true, status: res.status, data };
      }

      console.warn('[XQB Debug] API başarısız:', {
        url: `${baseUrl}${signPath}`,
        hasTid: Boolean(tid),
        tidLen: tid ? tid.length : 0,
        status: res.status,
        code: errCode,
        error: errMsg
      });

      return { ok: false, status: res.status, code: errCode, error: errMsg, data };
    };

    try {
      const primary = await sendToBase(win.location.origin, endpointPath);
      if (primary.ok) return primary;

      // x.com/i/api/1.1/... 404 verirse api.x.com/1.1/... yolunu da dene
      if (primary.status === 404 && endpointPath.startsWith('/i/api/')) {
        const apiPath = endpointPath.replace(/^\/i\/api/, '');
        const apiHost = win.location.hostname.includes('twitter.com')
          ? 'https://api.twitter.com'
          : 'https://api.x.com';
        const fallback = await sendToBase(apiHost, apiPath);
        if (fallback.ok) return fallback;
      }

      return primary;
    } catch (err) {
      return { ok: false, status: 0, error: err?.message || 'Ağ hatası' };
    }
  }

  // =========================================================================
  // 4. HESAP ENGELLEME & SESSİZE ALMA (X AYARLARINA GERÇEK KAYIT)
  // =========================================================================
  async function closeStrayMenus() {
    try {
      const openMenu = document.querySelector('[data-testid="Dropdown"]');
      if (openMenu) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        document.body?.click();
      }
    } catch (_) {}
  }

  async function performAccountAction(actionType, username, domTweetEl) {
    // actionType: 'block' | 'mute'
    const cleanHandle = username.replace(/^@/, '');
    const testId = actionType === 'block' ? 'block' : 'mute';
    let succeeded = false;

    // 1. ÖNCELİK: Yalnızca tıklanan kullanıcı doğrudan o tweet'in ana yazarıysa DOM akışını kullan
    if (domTweetEl) {
      document.documentElement.classList.add('xqb-stealth-active');
      try {
        const caret = domTweetEl.querySelector('[data-testid="caret"]');
        if (caret) {
          caret.click();
          const menuBtn = await waitForElement(`[data-testid="${testId}"]`, 900);
          if (menuBtn) {
            menuBtn.click();
            if (actionType === 'block') {
              const confirmBtn = await waitForElement('[data-testid="confirmationSheetConfirm"]', 1000);
              if (confirmBtn) {
                confirmBtn.click();
                succeeded = true;
              }
            } else {
              // X'te mute işlemi onay penceresi açmadan doğrudan uygulanır
              succeeded = true;
            }
          }
        }
      } catch (e) {
        console.warn(`[XQB] DOM ${actionType} uyarısı:`, e);
      } finally {
        if (!succeeded) await closeStrayMenus();
        setTimeout(() => {
          document.documentElement.classList.remove('xqb-stealth-active');
        }, 350);
      }
    }

    if (succeeded) return { ok: true, via: 'native-ui' };

    // 2. ÖNCELİK: Resmi X API (Ayarlar -> Engellenenler / Sessize Alınan Hesaplar'a yazar)
    const endpoint =
      actionType === 'block' ? '/i/api/1.1/blocks/create.json' : '/i/api/1.1/mutes/users/create.json';

    const userId = getUserIdFromStore(cleanHandle);
    const payload = { screen_name: cleanHandle };
    if (userId) payload.user_id = userId;
    if (actionType === 'block') payload.skip_status = '1';

    const apiRes = await callXApi(endpoint, payload);
    return { ...apiRes, via: 'api' };
  }

  async function undoAccountAction(actionType, username) {
    const cleanHandle = username.replace(/^@/, '');
    const endpoint =
      actionType === 'block' ? '/i/api/1.1/blocks/destroy.json' : '/i/api/1.1/mutes/users/destroy.json';
    const userId = getUserIdFromStore(cleanHandle);
    const payload = { screen_name: cleanHandle };
    if (userId) payload.user_id = userId;
    return callXApi(endpoint, payload);
  }

  // =========================================================================
  // 5. KELİME SESSİZE ALMA (X AYARLARINA GERÇEK KAYIT)
  // =========================================================================
  async function muteKeywordOnX(keyword, customOpts = null) {
    const cleanKeyword = keyword.trim();
    if (!cleanKeyword) return { ok: false, error: 'Boş kelime' };

    const settings = getSettings();
    const opts = customOpts || {
      duration: settings.muteDurationMs,
      mute_surfaces: settings.muteSurfaces,
      mute_options: settings.excludeFollowing ? 'exclude_following_accounts' : ''
    };

    // 1. ÖNCELİK: Doğrudan X Resmi Endpoint'i (/i/api/1.1/mutes/keywords/create.json)
    // Sunucu HTTP 200 veya code 85 (zaten kayıtlı) dönmeden başarılı sayılmaz.
    const apiRes = await callXApi('/i/api/1.1/mutes/keywords/create.json', {
      keyword: cleanKeyword,
      mute_surfaces: opts.mute_surfaces,
      mute_options: opts.mute_options,
      duration: opts.duration
    });
    if (apiRes.ok) {
      return { ...apiRes, via: 'api' };
    }

    // 2. ÖNCELİK (Yedek): X'in kendi Redux store thunk'ı (dinamik bulunduysa)
    try {
      const store = findReduxStore();
      const thunk = findMuteKeywordThunk();
      if (store && thunk) {
        const thunkRes = await store.dispatch(
          thunk({
            keyword: cleanKeyword,
            mute_surfaces: opts.mute_surfaces,
            mute_options: opts.mute_options,
            duration: opts.duration
          })
        );
        if (!thunkRes?.error && !thunkRes?.errors && thunkRes?.meta?.requestStatus !== 'rejected') {
          return { ok: true, via: 'redux' };
        }
      }
    } catch (errStore) {
      console.warn('[XQB] Redux thunk hatası:', errStore);
    }

    return { ...apiRes, via: 'api' };
  }

  // =========================================================================
  // 6. AKIŞ GİZLEME (REACT VIRTUALIZER DOSTU - .remove() YERİNE GÜVENLİ GİZLEME)
  // =========================================================================
  function getTweetContainerForHide(tweetEl) {
    return tweetEl.closest('[data-testid="cellInnerDiv"]') || tweetEl;
  }

  function hideElementSafely(el, tagValue) {
    const container = getTweetContainerForHide(el);
    if (container.dataset.xqbHidden) return;
    container.dataset.xqbHidden = tagValue;
    container.dataset.xqbOrigDisplay = container.style.display || '';
    container.style.display = 'none';
  }

  function restoreHiddenElements(tagValue) {
    document.querySelectorAll('[data-xqb-hidden]').forEach((el) => {
      if (!tagValue || el.dataset.xqbHidden === tagValue) {
        el.style.display = el.dataset.xqbOrigDisplay || '';
        delete el.dataset.xqbHidden;
        delete el.dataset.xqbOrigDisplay;
      }
    });
  }

  function tweetMatchesHandle(tweetEl, cleanLowerHandle) {
    const primaryUserBox = tweetEl.querySelector('[data-testid="User-Name"]');
    if (!primaryUserBox) return false;
    const links = primaryUserBox.querySelectorAll('a[href]');
    for (const a of links) {
      const href = (a.getAttribute('href') || '').toLowerCase().split('?')[0];
      if (href === '/' + cleanLowerHandle) return true;
    }
    return false;
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function tweetMatchesKeyword(tweetEl, keyword) {
    const textEl = tweetEl.querySelector('[data-testid="tweetText"]');
    if (!textEl) return false;
    const text = textEl.textContent.toLocaleLowerCase('tr-TR');
    const kw = keyword.trim().toLocaleLowerCase('tr-TR');
    if (!kw) return false;

    // Tek kelime ise kelime sınırına dikkat et; çok kelimeli ifadede doğrudan ifade ara
    if (!/\s/.test(kw) && /^[\p{L}\p{N}_]+$/u.test(kw)) {
      const rx = new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegex(kw)}($|[^\\p{L}\\p{N}_])`, 'u');
      return rx.test(text);
    }
    return text.includes(kw);
  }

  function hideUserTweetsFromFeed(username) {
    const cleanLower = username.replace(/^@/, '').toLowerCase();
    if (!cleanLower) return;
    sessionHiddenHandles.add(cleanLower);
    document.querySelectorAll('article[data-testid="tweet"]').forEach((tw) => {
      if (tweetMatchesHandle(tw, cleanLower)) {
        hideElementSafely(tw, `user:${cleanLower}`);
      }
    });
  }

  function hideTweetsContainingKeywords(keywords) {
    const list = keywords.map((k) => k.trim()).filter(Boolean);
    if (!list.length) return;
    list.forEach((k) => sessionMutedKeywords.add(k));

    document.querySelectorAll('article[data-testid="tweet"]').forEach((tw) => {
      for (const kw of list) {
        if (tweetMatchesKeyword(tw, kw)) {
          hideElementSafely(tw, `kw:${kw}`);
          break;
        }
      }
    });
  }

  // Oturum boyunca scroll ile yeni gelen tweet'lerde de gizlemeyi sürdür
  let feedObserverStarted = false;
  function startFeedObserver() {
    if (feedObserverStarted || !document.body) return;
    feedObserverStarted = true;

    let rafPending = false;
    const scanVisibleTweets = () => {
      rafPending = false;
      if (sessionHiddenHandles.size === 0 && sessionMutedKeywords.size === 0) return;

      document.querySelectorAll('article[data-testid="tweet"]').forEach((tw) => {
        const container = getTweetContainerForHide(tw);
        if (container.dataset.xqbHidden) return;

        for (const handle of sessionHiddenHandles) {
          if (tweetMatchesHandle(tw, handle)) {
            hideElementSafely(tw, `user:${handle}`);
            return;
          }
        }
        for (const kw of sessionMutedKeywords) {
          if (tweetMatchesKeyword(tw, kw)) {
            hideElementSafely(tw, `kw:${kw}`);
            return;
          }
        }
      });
    };

    const observer = new MutationObserver(() => {
      if (sessionHiddenHandles.size === 0 && sessionMutedKeywords.size === 0) return;
      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(scanVisibleTweets);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // =========================================================================
  // 7. MODALLAR: KULLANICI İŞLEMLERİ & ÇOKLU KELİME SESSİZE ALMA
  // =========================================================================
  function createOverlayBase(wide = false) {
    syncThemeWithX();
    document.querySelectorAll('.xqb-overlay').forEach((el) => el.remove());

    const overlay = document.createElement('div');
    overlay.className = 'xqb-overlay';

    const modal = document.createElement('div');
    modal.className = `xqb-modal${wide ? ' xqb-modal-wide' : ''}`;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'xqb-close-btn';
    closeBtn.setAttribute('title', 'Kapat (ESC)');
    closeBtn.setAttribute('aria-label', 'Kapat');
    closeBtn.appendChild(createSvgIcon(ICONS.close, 18));

    modal.appendChild(closeBtn);
    overlay.appendChild(modal);

    const handleEsc = (e) => {
      if (e.key === 'Escape') closeModal();
    };

    const closeModal = () => {
      document.removeEventListener('keydown', handleEsc);
      overlay.classList.remove('xqb-visible');
      setTimeout(() => overlay.remove(), 200);
    };

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener('keydown', handleEsc);

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('xqb-visible'));

    return { overlay, modal, closeModal };
  }

  function navigateSpaProfile(originalLinkEl, profileUrl) {
    if (originalLinkEl && document.contains(originalLinkEl)) {
      originalLinkEl.dataset.xqbBypass = '1';
      originalLinkEl.click();
      return;
    }
    try {
      const path = new URL(profileUrl).pathname;
      win.history.pushState({}, '', path);
      win.dispatchEvent(new PopStateEvent('popstate'));
    } catch (_) {
      win.location.href = profileUrl;
    }
  }

  function showQuickModal({
    displayName,
    username,
    avatarUrl,
    profileUrl,
    originalLinkEl,
    domTweetEl
  }) {
    const { modal, closeModal } = createOverlayBase(false);
    const myUsername = getLoggedInUsername();
    const isSelf = myUsername && myUsername === username.toLowerCase();

    // Header
    const header = document.createElement('div');
    header.className = 'xqb-header';

    const img = document.createElement('img');
    img.className = 'xqb-avatar';
    img.src =
      avatarUrl ||
      'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png';
    img.alt = displayName;

    const info = document.createElement('div');
    info.className = 'xqb-user-info';

    const nameEl = document.createElement('span');
    nameEl.className = 'xqb-display-name';
    nameEl.textContent = displayName;
    nameEl.title = displayName;

    const handleEl = document.createElement('span');
    handleEl.className = 'xqb-username';
    handleEl.textContent = `@${username}`;
    handleEl.title = `@${username}`;

    info.append(nameEl, handleEl);
    header.append(img, info);
    modal.appendChild(header);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'xqb-actions';

    const profileBtn = document.createElement('button');
    profileBtn.type = 'button';
    profileBtn.className = 'xqb-btn xqb-btn-profile';
    profileBtn.appendChild(createSvgIcon(ICONS.profile, 18));
    profileBtn.appendChild(document.createTextNode('Profiline Git'));
    profileBtn.addEventListener('click', () => {
      closeModal();
      navigateSpaProfile(originalLinkEl, profileUrl);
    });
    actions.appendChild(profileBtn);

    if (!isSelf) {
      const muteBtn = document.createElement('button');
      muteBtn.type = 'button';
      muteBtn.className = 'xqb-btn xqb-btn-mute';
      muteBtn.appendChild(createSvgIcon(ICONS.mute, 18));
      muteBtn.appendChild(document.createTextNode('Bu Hesabı Sessize Al'));

      const blockBtn = document.createElement('button');
      blockBtn.type = 'button';
      blockBtn.className = 'xqb-btn xqb-btn-block';
      blockBtn.appendChild(createSvgIcon(ICONS.block, 18));
      blockBtn.appendChild(document.createTextNode('Bu Hesabı Engelle'));

      const setBusy = (btn, labelText) => {
        muteBtn.classList.add('xqb-btn-loading');
        blockBtn.classList.add('xqb-btn-loading');
        btn.replaceChildren(createSvgIcon(ICONS.spinner, 18, true), document.createTextNode(labelText));
      };

      muteBtn.addEventListener('click', async () => {
        setBusy(muteBtn, 'Sessize alınıyor...');
        const res = await performAccountAction('mute', username, domTweetEl);
        closeModal();

        if (res.ok) {
          hideUserTweetsFromFeed(username);
          showToast(`@${username} X ayarlarında sessize alınan hesaplara eklendi.`, {
            undoLabel: 'Geri Al',
            onUndo: async () => {
              const undoRes = await undoAccountAction('mute', username);
              if (undoRes.ok) {
                sessionHiddenHandles.delete(username.toLowerCase());
                restoreHiddenElements(`user:${username.toLowerCase()}`);
                showToast(`@${username} sessizden çıkarıldı.`);
              } else {
                showToast(`Geri alınamadı: ${undoRes.error || 'Hata'}`, { isDanger: true });
              }
            }
          });
        } else {
          showToast(`@${username} X ayarlarına kaydedilemedi: ${res.error || 'Bilinmeyen hata'}`, {
            isDanger: true
          });
        }
      });

      blockBtn.addEventListener('click', async () => {
        setBusy(blockBtn, 'Engelleniyor...');
        const res = await performAccountAction('block', username, domTweetEl);
        closeModal();

        if (res.ok) {
          hideUserTweetsFromFeed(username);
          showToast(`@${username} X ayarlarında engellenenlere eklendi.`, {
            isDanger: true,
            undoLabel: 'Geri Al',
            onUndo: async () => {
              const undoRes = await undoAccountAction('block', username);
              if (undoRes.ok) {
                sessionHiddenHandles.delete(username.toLowerCase());
                restoreHiddenElements(`user:${username.toLowerCase()}`);
                showToast(`@${username} engeli kaldırıldı.`);
              } else {
                showToast(`Engel kaldırılamadı: ${undoRes.error || 'Hata'}`, { isDanger: true });
              }
            }
          });
        } else {
          showToast(`@${username} engellenemedi: ${res.error || 'Bilinmeyen hata'}`, {
            isDanger: true
          });
        }
      });

      actions.append(muteBtn, blockBtn);
    }

    modal.appendChild(actions);

    const hint = document.createElement('div');
    hint.className = 'xqb-hint';
    hint.textContent = isSelf
      ? 'Bu kendi hesabınız. Ctrl+Tık ile doğrudan açabilirsiniz.'
      : 'İşlemler doğrudan X Ayarlar → Sessize al ve engelle listesine kaydedilir.';
    modal.appendChild(hint);

    profileBtn.focus();
  }

  function extractIndividualWords(rawText) {
    const tokens = rawText
      .split(/[\s,;|/]+/)
      .map((w) => w.replace(/^[^\p{L}\p{N}#@]+|[^\p{L}\p{N}]+$/gu, '').trim())
      .filter((w) => w.length >= 2);
    // Benzersiz kelimeleri sırayla döndür (büyük/küçük harf duyarsız tekilleştirme)
    const seen = new Set();
    const unique = [];
    for (const w of tokens) {
      const key = w.toLocaleLowerCase('tr-TR');
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(w);
      }
    }
    return unique;
  }

  async function executeMuteKeywordsBatch(keywords, customOpts) {
    const settings = getSettings();
    const opts = customOpts || {
      duration: settings.muteDurationMs,
      mute_surfaces: settings.muteSurfaces,
      mute_options: settings.excludeFollowing ? 'exclude_following_accounts' : ''
    };

    const succeeded = [];
    const alreadyMuted = [];
    const failed = [];

    for (let i = 0; i < keywords.length; i++) {
      const kw = keywords[i].trim();
      if (!kw) continue;

      const res = await muteKeywordOnX(kw, opts);
      if (res.ok) {
        if (res.alreadyExists) alreadyMuted.push(kw);
        else succeeded.push(kw);
      } else {
        failed.push({ kw, error: res.error || `HTTP ${res.status}` });
      }

      if (i < keywords.length - 1) {
        await new Promise((r) => setTimeout(r, 180));
      }
    }

    const toHide = [...succeeded, ...alreadyMuted];
    if (settings.hideLocallyAfterApi && toHide.length > 0) {
      hideTweetsContainingKeywords(toHide);
    }

    if (failed.length === 0) {
      const totalOk = succeeded.length + alreadyMuted.length;
      if (totalOk === 1) {
        const w = toHide[0];
        showToast(
          alreadyMuted.length === 1
            ? `"${w}" zaten X sessize alınan kelimelerde kayıtlı.`
            : `"${w}" X ayarlarına (Sessize alınan kelimeler) eklendi.`
        );
      } else {
        showToast(`${totalOk} kelime X ayarlarına (Sessize alınan kelimeler) kaydedildi.`);
      }
    } else if (succeeded.length + alreadyMuted.length > 0) {
      showToast(
        `${succeeded.length + alreadyMuted.length} kelime kaydedildi, ${failed.length} kelime başarısız (${failed[0].error}).`,
        { isDanger: true }
      );
    } else {
      showToast(`X ayarlarına kaydedilemedi: ${failed[0].error}`, { isDanger: true });
    }
  }

  function showMultiKeywordModal(initialWords = [], fullPhrase = '') {
    const { modal, closeModal } = createOverlayBase(true);
    const settings = getSettings();

    const title = document.createElement('h3');
    title.className = 'xqb-modal-title';
    title.textContent = 'Kelimeleri X Ayarlarına Sessize Al';

    const desc = document.createElement('p');
    desc.className = 'xqb-modal-desc';
    desc.textContent =
      'Seçili kelimeleri işaretleyin veya yeni kelimeler ekleyin. Her biri doğrudan X Ayarlar → Sessize alınan kelimeler listesine kaydedilir.';

    const selectedMap = new Map();
    initialWords.forEach((w) => selectedMap.set(w, true));

    const chipsWrap = document.createElement('div');
    chipsWrap.className = 'xqb-chips';

    const submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = 'xqb-btn xqb-btn-block';

    const updateSubmitLabel = () => {
      const activeCount = Array.from(selectedMap.values()).filter(Boolean).length;
      submitBtn.replaceChildren(
        createSvgIcon(ICONS.mute, 18),
        document.createTextNode(
          activeCount > 0
            ? `Seçili ${activeCount} Kelimeyi X Ayarlarına Kaydet`
            : 'En az 1 kelime seçin'
        )
      );
      submitBtn.disabled = activeCount === 0;
      submitBtn.style.opacity = activeCount === 0 ? '0.5' : '1';
    };

    const renderChips = () => {
      chipsWrap.replaceChildren();
      for (const [word, isActive] of selectedMap.entries()) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `xqb-chip${isActive ? ' xqb-chip-active' : ''}`;
        chip.textContent = `${isActive ? '✓ ' : '+ '}${word}`;
        chip.addEventListener('click', () => {
          selectedMap.set(word, !selectedMap.get(word));
          renderChips();
          updateSubmitLabel();
        });
        chipsWrap.appendChild(chip);
      }
    };

    // Özel kelime ekleme satırı
    const inputRow = document.createElement('div');
    inputRow.className = 'xqb-input-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'xqb-input';
    input.placeholder = 'Ek kelime ekle (virgülle ayırabilirsiniz)...';

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'xqb-btn xqb-btn-profile';
    addBtn.style.width = 'auto';
    addBtn.style.padding = '8px 14px';
    addBtn.textContent = 'Ekle';

    const addCustomWords = () => {
      const raw = input.value.trim();
      if (!raw) return;
      const parts = raw.includes(',')
        ? raw.split(',').map((s) => s.trim()).filter((s) => s.length >= 2)
        : [raw];
      parts.forEach((p) => selectedMap.set(p, true));
      input.value = '';
      renderChips();
      updateSubmitLabel();
    };

    addBtn.addEventListener('click', addCustomWords);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addCustomWords();
      }
    });
    inputRow.append(input, addBtn);

    // Süre ve takip edilenler seçenekleri
    const optionsGrid = document.createElement('div');
    optionsGrid.className = 'xqb-options-grid';

    const durationSelect = document.createElement('select');
    durationSelect.className = 'xqb-select';
    [
      { val: '', label: 'Süre: Sonsuz' },
      { val: '86400000', label: 'Süre: 24 Saat' },
      { val: '604800000', label: 'Süre: 7 Gün' },
      { val: '2592000000', label: 'Süre: 30 Gün' }
    ].forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt.val;
      o.textContent = opt.label;
      if (settings.muteDurationMs === opt.val) o.selected = true;
      durationSelect.appendChild(o);
    });

    const followLabel = document.createElement('label');
    followLabel.className = 'xqb-checkbox-wrap';
    const followCheck = document.createElement('input');
    followCheck.type = 'checkbox';
    followCheck.checked = settings.excludeFollowing;
    const followSpan = document.createElement('span');
    followSpan.textContent = 'Takip edilenler hariç';
    followLabel.append(followCheck, followSpan);

    optionsGrid.append(durationSelect, followLabel);

    const actions = document.createElement('div');
    actions.className = 'xqb-actions';
    actions.appendChild(submitBtn);

    // İstersen tam ifadeyi de ayrıca butonla ekle
    if (fullPhrase && /\s/.test(fullPhrase) && initialWords.length > 1) {
      const phraseBtn = document.createElement('button');
      phraseBtn.type = 'button';
      phraseBtn.className = 'xqb-btn xqb-btn-mute';
      phraseBtn.textContent = `Tam İfadeyi Ekle: "${
        fullPhrase.length > 26 ? fullPhrase.slice(0, 24) + '...' : fullPhrase
      }"`;
      phraseBtn.addEventListener('click', async () => {
        const nextSettings = {
          ...settings,
          muteDurationMs: durationSelect.value,
          excludeFollowing: followCheck.checked
        };
        saveSettings(nextSettings);

        phraseBtn.classList.add('xqb-btn-loading');
        submitBtn.classList.add('xqb-btn-loading');
        await executeMuteKeywordsBatch([fullPhrase], {
          duration: durationSelect.value,
          mute_surfaces: settings.muteSurfaces,
          mute_options: followCheck.checked ? 'exclude_following_accounts' : ''
        });
        closeModal();
      });
      actions.appendChild(phraseBtn);
    }

    submitBtn.addEventListener('click', async () => {
      const wordsToMute = Array.from(selectedMap.entries())
        .filter(([, active]) => active)
        .map(([w]) => w);
      if (!wordsToMute.length) return;

      const nextSettings = {
        ...settings,
        muteDurationMs: durationSelect.value,
        excludeFollowing: followCheck.checked
      };
      saveSettings(nextSettings);

      submitBtn.classList.add('xqb-btn-loading');
      submitBtn.replaceChildren(
        createSvgIcon(ICONS.spinner, 18, true),
        document.createTextNode('X ayarlarına kaydediliyor...')
      );

      await executeMuteKeywordsBatch(wordsToMute, {
        duration: durationSelect.value,
        mute_surfaces: settings.muteSurfaces,
        mute_options: followCheck.checked ? 'exclude_following_accounts' : ''
      });
      closeModal();
    });

    modal.append(title, desc, chipsWrap, inputRow, optionsGrid, actions);
    renderChips();
    updateSubmitLabel();
  }

  // =========================================================================
  // 8. METİN SEÇİMİ POPOVER YÖNETİMİ
  // =========================================================================
  let popoverEl = null;
  let primaryPopBtn = null;
  let primaryPopLabel = null;
  let secondaryPopBtn = null;
  let secondaryPopLabel = null;
  let currentSelectedText = '';
  let currentIndividualWords = [];
  let isPopoverBusy = false;
  let checkTimer = null;

  function ensurePopover() {
    if (popoverEl) return popoverEl;

    popoverEl = document.createElement('div');
    popoverEl.className = 'xqb-popover';

    primaryPopBtn = document.createElement('button');
    primaryPopBtn.type = 'button';
    primaryPopBtn.className = 'xqb-popover-btn';
    primaryPopBtn.appendChild(createSvgIcon(ICONS.mute, 15));
    primaryPopLabel = document.createElement('span');
    primaryPopLabel.className = 'xqb-popover-label';
    primaryPopBtn.appendChild(primaryPopLabel);

    secondaryPopBtn = document.createElement('button');
    secondaryPopBtn.type = 'button';
    secondaryPopBtn.className = 'xqb-popover-btn xqb-popover-btn-secondary';
    secondaryPopBtn.appendChild(createSvgIcon(ICONS.list, 15));
    secondaryPopLabel = document.createElement('span');
    secondaryPopBtn.appendChild(secondaryPopLabel);

    popoverEl.append(primaryPopBtn, secondaryPopBtn);
    document.documentElement.appendChild(popoverEl);

    const stopSelectionLoss = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    popoverEl.addEventListener('pointerdown', stopSelectionLoss);
    popoverEl.addEventListener('mousedown', stopSelectionLoss);

    primaryPopBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isPopoverBusy || !currentSelectedText) return;

      const phrase = currentSelectedText;
      isPopoverBusy = true;
      primaryPopLabel.textContent = 'X ayarlarına ekleniyor...';

      try {
        await executeMuteKeywordsBatch([phrase]);
      } finally {
        isPopoverBusy = false;
        hidePopover();
        win.getSelection()?.removeAllRanges();
      }
    });

    secondaryPopBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isPopoverBusy || !currentIndividualWords.length) return;

      const words = [...currentIndividualWords];
      const phrase = currentSelectedText;
      hidePopover();
      win.getSelection()?.removeAllRanges();
      showMultiKeywordModal(words, phrase);
    });

    return popoverEl;
  }

  function hidePopover() {
    if (popoverEl && !isPopoverBusy) {
      popoverEl.classList.remove('xqb-popover-show');
      currentSelectedText = '';
      currentIndividualWords = [];
    }
  }

  function isNodeInInput(node) {
    if (!node) return false;
    const el = node.nodeType === 1 ? node : node.parentElement;
    if (!el) return false;
    return !!el.closest(
      'input, textarea, [contenteditable="true"], [data-testid="tweetTextarea_0"], .xqb-overlay'
    );
  }

  function handleTextSelection() {
    if (isPopoverBusy) return;

    const selection = win.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      hidePopover();
      return;
    }

    const rawText = selection.toString().replace(/\s+/g, ' ').trim();
    if (rawText.length < 2 || rawText.length > 100) {
      hidePopover();
      return;
    }

    const range = selection.getRangeAt(0);
    if (isNodeInInput(range.commonAncestorContainer)) {
      hidePopover();
      return;
    }

    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      hidePopover();
      return;
    }

    syncThemeWithX();
    ensurePopover();

    currentSelectedText = rawText;
    currentIndividualWords = extractIndividualWords(rawText);

    const shortWord = rawText.length > 20 ? rawText.substring(0, 18) + '...' : rawText;
    if (currentIndividualWords.length > 1) {
      primaryPopLabel.textContent = `"${shortWord}" ifadesini sessize al`;
      secondaryPopLabel.textContent = `Kelimeleri seç (${currentIndividualWords.length})`;
      secondaryPopBtn.style.display = 'inline-flex';
    } else {
      primaryPopLabel.textContent = `"${shortWord}" kelimesini sessize al`;
      secondaryPopBtn.style.display = 'none';
    }

    // Gerçek genişliği ölçerek ekran sınırları içine hizala
    popoverEl.style.visibility = 'hidden';
    popoverEl.classList.add('xqb-popover-show');
    const popRect = popoverEl.getBoundingClientRect();
    const popW = popRect.width || 240;
    const popH = popRect.height || 38;
    popoverEl.style.visibility = '';

    let top = rect.top - popH - 8;
    let left = rect.left + rect.width / 2 - popW / 2;

    if (left < 10) left = 10;
    if (left + popW > win.innerWidth - 10) {
      left = Math.max(10, win.innerWidth - popW - 10);
    }
    if (top < 10) {
      top = rect.bottom + 8;
    }

    popoverEl.style.top = `${top}px`;
    popoverEl.style.left = `${left}px`;
  }

  function triggerSelectionCheck() {
    clearTimeout(checkTimer);
    checkTimer = setTimeout(handleTextSelection, 70);
  }

  // =========================================================================
  // 9. BAŞLATMA: OLAY DİNLEYİCİLER & KULLANICI ADI TIKLAMA YAKALAYICI
  // =========================================================================
  function initUIEvents() {
    injectStyles();
    startFeedObserver();

    if (typeof GM_registerMenuCommand === 'function') {
      try {
        GM_registerMenuCommand('Toplu Kelime Sessize Al (X Ayarlarına Kaydet)', () => {
          showMultiKeywordModal([], '');
        });
      } catch (_) {}
    }

    document.addEventListener('mouseup', triggerSelectionCheck);
    document.addEventListener('keyup', (e) => {
      if (e.shiftKey || e.key === 'Shift') triggerSelectionCheck();
      if (e.key === 'Escape') hidePopover();
    });

    document.addEventListener('pointerdown', (e) => {
      if (popoverEl && !popoverEl.contains(e.target)) {
        hidePopover();
      }
    });

    win.addEventListener('scroll', hidePopover, { passive: true, capture: true });

    // Kullanıcı Adı Tıklama Yakalayıcı
    win.addEventListener(
      'click',
      (event) => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
          return;
        }

        const clickedLink = event.target.closest('a');
        if (clickedLink && clickedLink.dataset.xqbBypass === '1') {
          delete clickedLink.dataset.xqbBypass;
          return;
        }

        const userNameContainer = event.target.closest('[data-testid="User-Name"]');
        if (!userNameContainer) return;

        // Zaman damgasına (/status/123) tıklandıysa normal tweet detayına gitmesine izin ver
        if (clickedLink) {
          const clickedHref = clickedLink.getAttribute('href') || '';
          if (clickedHref.includes('/status/') || clickedHref.includes('/analytics')) return;
        }

        let targetProfileLink = null;
        const links = userNameContainer.querySelectorAll('a[role="link"], a[href]');
        for (const a of links) {
          const href = a.getAttribute('href') || '';
          if (
            href.startsWith('/') &&
            !href.includes('/status/') &&
            !href.includes('/hashtag/') &&
            !href.includes('/analytics')
          ) {
            targetProfileLink = a;
            break;
          }
        }

        const profileLink =
          clickedLink && (clickedLink.getAttribute('href') || '').startsWith('/')
            ? clickedLink
            : targetProfileLink;
        if (!profileLink) return;

        const rawHref = profileLink.getAttribute('href') || '';
        const usernameFromHref = rawHref.split('/').filter(Boolean)[0] || '';
        if (!usernameFromHref) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        // Kullanıcı adını ve görünen adı çıkar
        let displayName = '';
        let username = '';
        userNameContainer.querySelectorAll('span').forEach((sp) => {
          const txt = sp.textContent.trim();
          if (!txt) return;
          if (txt.startsWith('@') && !txt.includes(' ')) {
            username = txt.slice(1);
          } else if (!displayName && !txt.startsWith('@')) {
            displayName = txt;
          }
        });

        if (!username) username = usernameFromHref;
        if (!displayName) displayName = username;

        // Alıntı Tweet (Quote Tweet) koruması:
        // Yalnızca tıklanan User-Name ana tweet'in ilk User-Name başlığı ise DOM caret akışını kullan
        const parentArticle = userNameContainer.closest('article[data-testid="tweet"]');
        let domTweetEl = null;
        let avatarUrl = '';

        if (parentArticle) {
          const primaryUserName = parentArticle.querySelector('[data-testid="User-Name"]');
          const isPrimaryAuthor = primaryUserName === userNameContainer;

          if (isPrimaryAuthor) {
            domTweetEl = parentArticle;
            const avatarImg =
              parentArticle.querySelector('[data-testid="Tweet-User-Avatar"] img[src*="profile_images"]') ||
              parentArticle.querySelector('img[src*="profile_images"]');
            if (avatarImg) avatarUrl = avatarImg.src;
          } else {
            // Alıntı tweet içindeki kullanıcı: kendi satırındaki küçük avatarı bul
            const quoteHeader = userNameContainer.parentElement?.parentElement;
            const quoteAvatar = quoteHeader?.querySelector('img[src*="profile_images"]');
            if (quoteAvatar) avatarUrl = quoteAvatar.src;
          }
        } else {
          // Profil sayfası başlığı gibi article dışı yerler
          const profileAvatar = document.querySelector(
            `a[href="/${username}/photo" i] img[src*="profile_images"]`
          );
          if (profileAvatar) avatarUrl = profileAvatar.src;
        }

        const profileUrl = `${win.location.origin}/${username}`;

        showQuickModal({
          displayName,
          username,
          avatarUrl,
          profileUrl,
          originalLinkEl: profileLink,
          domTweetEl
        });
      },
      true
    );

    console.log('[XQB v4.0.0] Yüklendi: Dinamik X.com API & Çoklu Kelime Sessize Alma Aktif.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUIEvents, { once: true });
  } else {
    initUIEvents();
  }
})();
