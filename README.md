<div align="center">

# rennzsync/baileys

**Lightweight WhatsApp Bot library — fully rebased onto `@whiskeysockets/baileys` 7.0.0-rc14**

[![Version](https://img.shields.io/badge/npm-10.2.0-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://www.npmjs.com/package/@renz/baileys)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Baileys](https://img.shields.io/badge/Base-Baileys%207.0.0--rc14-blue?style=for-the-badge)](https://github.com/WhiskeySockets/Baileys)
[![License](https://img.shields.io/badge/License-MIT%20%2B%20GPL--3.0%20dep-blue?style=for-the-badge)](LICENSE)

**[Baca dalam Bahasa Indonesia → README.id.md](README.id.md)**

</div>

A WhatsApp Multi-Device library rebased onto Baileys v7 rc14, using the original Signal Protocol engine (`libsignal`, GPL-3.0) — the same one stock `@whiskeysockets/baileys` rc14 ships with.

> **License note:** `rennzsync/baileys`'s own code is MIT, but it depends on `libsignal` (GPL-3.0) at runtime for the Signal Protocol crypto. If you're publishing or redistributing this package, check what GPL-3.0 compliance means for your use case — this isn't legal advice.

Project focus: **multimedia WhatsApp bots** — audio, video, image and sticker pipelines, plus **Rich WebUI** (inline HTML interfaces rendered inside chat bubbles), with RAM-friendly defaults.

---

## Highlights

- **Full Baileys 7.0.0-rc14 parity** — complete TC-token implementation (trusted contact tokens with expiry & re-issue), Signal Repository API v7 (`getSessionInfo`, `hasSenderKey`, `getSenderKeyDistributionMessage`), new QR/pairing format, reachout timelock handling.
- **Standard Signal Protocol engine** — uses `libsignal` directly, same as stock Baileys rc14; no custom native crypto to maintain.
- **Centralized multimedia pipeline** — `media-processor` utilities (ffmpeg/sharp/audio-decode, lazy-loaded).
- **Rich WebUI** — render HTML/CSS/JS interfaces directly inside chat bubbles via `sendInlineWebUI`.
- **RAM-friendly by default** — `syncFullHistory: false`, `enableRecentMessageCache: false`, moderate cache TTLs.

---

## Requirements

| Requirement | Version |
|---|---|
| Node.js | >= 20.0.0 |

Platform support follows whatever `libsignal` (^6.0.0) supports on your system — see that package's own docs for prebuilt binary/platform coverage.

---

## Installation

```bash
npm install @rennzsync/baileys
```

### Optional dependencies (install per feature)

| Package | Feature |
|---|---|
| `audio-decode` | Voice note waveform (`ptt: true`) — **required for voice notes** |
| `sharp` | Image resize/compression |
| `fluent-ffmpeg` | Video/audio conversion, video thumbnails |
| `jimp` | Alternative thumbnails (without sharp) |
| `link-preview-js` | Link previews |

---

## Quick Start

```js
import makeWASocket, { useMultiFileAuthState } from '@rennzsync/baileys';

const { state, saveCreds } = await useMultiFileAuthState('auth_info');

const sock = makeWASocket({
  auth: state,
  printQRInTerminal: true
});

sock.ev.on('creds.update', saveCreds);

sock.ev.on('messages.upsert', async ({ messages }) => {
  const msg = messages[0];
  if (!msg.message || msg.key.fromMe) return;

  const jid = msg.key.remoteJid;
  const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

  if (text === '!ping') {
    await sock.sendMessage(jid, { text: 'pong' }, { quoted: msg });
  }
});
```

---

## Examples: Multimedia

### Send an image with caption

```js
await sock.sendMessage(jid, {
  image: { url: 'https://example.com/photo.jpg' },
  caption: 'Hello!'
});
```

### Send a voice note (PTT)

```js
// requires: npm install audio-decode
await sock.sendMessage(jid, {
  audio: { url: './voice.ogg' },
  mimetype: 'audio/ogg; codecs=opus',
  ptt: true
});
```

### Convert video/audio before sending (media-processor)

```js
import { convertToWhatsAppVideo, convertToOpusAudio, getVideoThumbnail, resizeImage } from '@rennzsync/baileys';

// Any video -> WhatsApp-compatible MP4/H.264 (requires fluent-ffmpeg)
const mp4 = await convertToWhatsAppVideo(rawBuffer);
await sock.sendMessage(jid, { video: mp4, caption: 'Converted video' });

// Any audio -> OGG/Opus for voice notes
const opus = await convertToOpusAudio(audioBuffer);

// Video thumbnail & image resize (requires sharp)
const thumb = await getVideoThumbnail(mp4, 1);
const small = await resizeImage(imageBuffer, { width: 300, height: 300 });
```

### Probe media metadata

```js
import { probeMedia, getMp4Duration } from '@rennzsync/baileys';

const meta = await probeMedia(buffer, 'audio/mpeg'); // { duration, bitrate, container, codec }
const dur = getMp4Duration(mp4Buffer); // no ffmpeg needed — parses atoms directly
```

---

## Examples: Rich WebUI (inline HTML in chat bubbles)

Send an HTML/CSS/JS interface that **renders directly inside the message bubble** — great for interactive menus, mini-apps and dashboards:

```js
import { sendInlineWebUI } from '@rennzsync/baileys';

const html = `<!DOCTYPE html>
<html><head><style>body{background:#111b21;color:#fff;font-family:sans-serif;padding:16px}</style></head>
<body><h2>Bot Menu</h2><button onclick="alert('hi')">Press me</button></body></html>`;

await sendInlineWebUI(sock, jid, html, 'Bot Menu');

// Identity can be overridden (default: Meta AI)
await sendInlineWebUI(sock, jid, html, 'Bot Menu', {
  botJid: '12345@bot',
  forwardOrigin: 'CUSTOM'
});
```

> Note: the HTML primitive name (`GenAIaeacdsnwHtmlPrimitive`) is an obfuscated WhatsApp Web identifier and may change between WA versions. If the WebUI stops rendering, update the identifier from the latest WA Web bundle.

---

## Examples: Classic buttons & lists (render everywhere, new in 10.0.1)

`interactiveMessage` + `nativeFlowMessage` cards are **no longer rendered** on many WhatsApp clients — `relayMessage` succeeds without error but the message silently doesn't appear. The classic `buttonsMessage` and `listMessage` templates render reliably on **every** client (Android/iOS/Web/Desktop).

`@rennzsync/baileys@10.4.0` ships ready-made builders in `lib/Utils/rich-classic.js`:

```js
import { buildButtonsMessage, buildListMessage, sendClassicMessage } from '@rennzsync/baileys';

// 1-3 quick-reply buttons (optionally with a location+thumbnail header)
const buttons = buildButtonsMessage({
  text: 'Hello Brother — pick an option',
  footer: '© My Bot',
  buttons: [
    { buttonId: '.owner', buttonText: 'Owner' },
    { buttonId: '.allmenu', buttonText: 'Allmenu' },
  ],
  locationMessage: { jpegThumbnail, name: 'My Bot', address: 'v10.0.1' },
});

// Scrollable list with sections and rows
const list = buildListMessage({
  title: 'Menu — 1271 commands',
  description: 'Pick a category',
  buttonText: 'Pilih Kategori',
  sections: [{
    title: 'Categories',
    rows: [
      { title: 'main', description: '19 commands', rowId: '.menucat main' },
      { title: 'sticker', description: '42 commands', rowId: '.menucat sticker' },
    ],
  }],
});

// Send via relayMessage — userJid is normalized automatically
// (handles sock.user.id vs the legacy non-existent sock.user.jid)
await sendClassicMessage(sock, jid, buttons);
await sendClassicMessage(sock, jid, list);
```

Also exports `normalizeUserJid(sockOrUserOrJid)` — `sock.user.jid` never existed in baileys 7.x (`sock.user` is `creds.me`, which has `.id`); this helper accepts any shape and returns a valid jid.

---

## Examples: Carousel & native-flow buttons (new in 10.0.3, risk-aware)

`lib/Utils/rich-carousel.js` adds `interactiveMessage`/`carouselMessage` builders (the horizontal-scroll card format), for cases where you specifically need carousel or richer CTA button types (`cta_url`, `cta_call`, `cta_copy`, `cta_reminder`, `single_select`) that the classic templates above don't cover. Same rendering caveat as always: prefer `rich-classic.js` unless you specifically need these.

```js
import { buildCarouselMessage, sendCarouselMessage, sendInteractiveMessage } from '@rennzsync/baileys';

// single native-flow bubble (no carousel)
await sendInteractiveMessage(sock, jid, {
  text: 'Choose an action:',
  footer: '© My Bot',
  buttons: [
    { type: 'quick_reply', displayText: 'Owner', id: '.owner' },
    { type: 'cta_url', displayText: 'Docs', url: 'https://github.com/RennZSync/baileys' },
  ],
});

// multi-card carousel
await sendCarouselMessage(sock, jid, {
  text: 'Pick a product:',
  cards: [
    {
      header: { title: 'Product A', mediaKind: 'thumbnail', jpegThumbnail },
      text: 'Rp 50.000',
      buttons: [{ type: 'quick_reply', displayText: 'Buy', id: 'buy_a' }],
    },
    {
      header: { title: 'Product B', mediaKind: 'thumbnail', jpegThumbnail },
      text: 'Rp 75.000',
      buttons: [{ type: 'quick_reply', displayText: 'Buy', id: 'buy_b' }],
    },
  ],
});
```

Lower-level `buildInteractiveCard(...)` and `buildNativeFlowButton(...)` are also exported if you want the raw content object instead of the send-shortcut.

---

## Full-size profile pictures (new in 10.0.3)

`generateProfilePicture` (used by `updateProfilePicture` and `newsletterUpdatePicture`) now accepts `{ full: true }` to skip the forced 640×640 crop/quality-50 downscale and upload closer to the source resolution/quality instead:

```js
await sock.updateProfilePicture(sock.user.id, imageBuffer, { full: true }); // ~quality 92, no resize
await sock.updateProfilePicture(sock.user.id, imageBuffer, { width: 1024, height: 1024, quality: 85 }); // custom
await sock.updateProfilePicture(sock.user.id, imageBuffer); // unchanged default behavior (640x640, q50)
```

---

## In-memory / cache-manager Store & SQLite auth (new in 10.1.0)

`lib/Store/*` ships a chat/contact/message store you can wire into `sock.ev`, plus two auth-state backends:

```js
import makeWASocket, { makeInMemoryStore, useSqliteAuthState, useMultiFileAuthState } from '@rennzsync/baileys';

const store = makeInMemoryStore({});
store.readFromFile('./store.json');
setInterval(() => store.writeToFile('./store.json'), 10_000);

// SQLite auth (requires Node >= 22.5, built-in node:sqlite — throws a clear error on older Node)
const { state, saveCreds } = await useSqliteAuthState('./auth.db');
// or the classic file-based one, unchanged:
// const { state, saveCreds } = await useMultiFileAuthState('auth_info');

const sock = makeWASocket({ auth: state });
store.bind(sock.ev);
sock.ev.on('creds.update', saveCreds);
```

`makeCacheManagerAuthState` is also available if you'd rather back auth state with a `cache-manager` store (optional peer dep, only required if you actually call it).

`sock.sendMessage(jid, content, { isSecret, protected, me })` — three extra device/recipient filters ported from `@vansnowi/baileys`, forwarded straight through to `relayMessage`.

---

## Image poll (new in 10.2.0)

Send a poll where each option is an image instead of plain text (`pollCreationMessageV3` with `pollContentType: IMAGE`, one `pollCreationOptionImageMessage` per option, associated back to the parent poll via `MEDIA_POLL`):

```js
import { generateWAMessageFromImagePoll } from '@rennzsync/baileys';

await generateWAMessageFromImagePoll(jid, {
  name: 'Pilih gambar favorit',
  selectableCount: 1,
  options: [
    { name: 'Gambar 1', image: { url: 'https://example.com/1.jpg' } },
    { name: 'Gambar 2', image: { url: 'https://example.com/2.jpg' } },
  ]
}, (msg, opts) => sock.relayMessage(jid, msg, opts), { upload: sock.waUploadToServer });
```

`hashImagePollOption(optionName, fileSha256)` is also exported separately if you need the option hash without the full send flow. Note: this is a client-side implementation of a message type WhatsApp's own proto defines but no Baileys fork (upstream included) ships a builder for — treat it as experimental and verify rendering on your target WA client build before relying on it in production.

---

## Default Configuration (RAM-friendly)

```js
const sock = makeWASocket({
  auth: state,
  // already frugal by default; override if needed:
  syncFullHistory: false,          // don't pull full chat history
  enableRecentMessageCache: false, // don't keep recent messages in RAM
});
```

---

## Breaking Changes from 9.x (legacy renzsync-baileys)

- Base rebased to Baileys **7.0.0-rc14** 
- Removed modules: `lib/VoIP/*` (WebRTC call client), `Modded/message_builder.js`, `Utils/rich-messages.js`, `Socket/dugong.js`, `Utils/sticker-pack.js`.
  - `rejectCall` remains available (core `messages-recv`).
  - Replacement for the old rich messages: `rich-webui.js` (`sendInlineWebUI`, `buildWebuiMessage`).
- **10.0.1:** added `rich-classic.js` (`buildButtonsMessage`, `buildListMessage`, `sendClassicMessage`, `normalizeUserJid`) — `interactiveMessage`/`nativeFlowMessage` cards no longer render on many clients; use the classic templates for maximum compatibility.
- **10.0.2:** restored the ob9 auto-inject of the `<biz>` stanza node (ported from ourin-baileys 9.0.21) — `relayMessage` now automatically attaches the `biz` interactive node for `buttonsMessage` / `listMessage` / `interactiveMessage`+`nativeFlowMessage` payloads, unless the caller already provides one. Without this node the server accepts the stanza but the receiving client never renders the card (relay succeeds silently, message never appears). This regressed during the rebase to Baileys 7 and was the root cause of invisible button/list menus.
- **10.0.3:** added `rich-carousel.js` (`buildCarouselMessage`, `buildInteractiveMessage`, `buildInteractiveCard`, `buildNativeFlowButton`, `sendCarouselMessage`, `sendInteractiveMessage`) for carousel cards and richer native-flow CTA buttons (`cta_url`/`cta_call`/`cta_copy`/`cta_reminder`/`single_select`). Also extended `generateProfilePicture` (and `updateProfilePicture` / `newsletterUpdatePicture`) with a `{ full: true }` option to upload profile pictures at source resolution/high quality instead of the forced 640×640 quality-50 downscale.
- **10.1.0:** merged in `lib/Store/*` (in-memory store, cache-manager store, keyed-db/ordered-dictionary/object-repository) from `@vansnowi/baileys`, plus `useSqliteAuthState` (Node 22.5+ built-in `node:sqlite`, with a clear fallback error on older Node) and `isSecret`/`protected`/`me`-only send filters wired into `sock.sendMessage`.
- **10.2.0:** added `generateWAMessageFromImagePoll` / `hashImagePollOption` — client-side builder for WhatsApp's image-poll message type (`pollCreationMessageV3` + `pollCreationOptionImageMessage`, `MEDIA_POLL` association). Experimental — no upstream Baileys fork ships this.
- Default config changed: `syncFullHistory` and `enableRecentMessageCache` are now `false`.
- `protobufjs-cli` pinned to `^1.1.3` (peer dependency conflict fix); `link-preview-js` to `^5.0.0` (SSRF advisory fix).
- **Rebrand:** package renamed to `@renz/baileys`, now maintained by [RennZz-Dev](https://github.com/RennZSync). No API changes — update your imports from `onigis` to `@renz/baileys`.
- **Signal engine reverted to stock:** dropped the custom `@renz/signal`/`@renz/curve25519` (MIT, native Rust) engine and went back to the original `libsignal` (GPL-3.0) used by stock Baileys rc14 — same Signal Protocol implementation, no more custom native binaries to build/ship. See the license note near the top of this file.

---

## Testing

```bash
npm test 
```

Includes unit tests for: JID utils (PN/LID/hosted), Rich WebUI (build + proto encode/decode roundtrip).

---

## Credits

- **[RennZz-Dev](https://github.com/RennZSync)** — `rennzsync/baileys` maintainer: rebrand, ongoing upkeep & bot-focused tweaks
- **[WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys)** — upstream library & original Signal Protocol wrapper (`libsignal`-based)

---

## License

**MIT** for `rennzsync/baileys`'s own code — but it depends on `libsignal` (GPL-3.0) at runtime for Signal Protocol crypto. Check what that means for your use case before redistributing.
