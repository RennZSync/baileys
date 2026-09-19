<div align="center">

# rennzsync/baileys

**Library WhatsApp Bot ringan — full rebase dari `@whiskeysockets/baileys` 7.0.0-rc14**

[![Version](https://img.shields.io/badge/npm-10.5.0-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://www.npmjs.com/package/@rennzsync/baileys)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Baileys](https://img.shields.io/badge/Base-Baileys%207.0.0--rc14-blue?style=for-the-badge)](https://github.com/WhiskeySockets/Baileys)
[![License](https://img.shields.io/badge/License-MIT%20%2B%20GPL--3.0%20dep-blue?style=for-the-badge)](LICENSE)

**[Read in English → README.md](README.md)**

</div>

Library WhatsApp Multi-Device hasil rebase dari Baileys v7 rc14, pakai engine Signal Protocol yang asli (`libsignal`, GPL-3.0) — sama persis dengan yang dipakai stock `@whiskeysockets/baileys` rc14.

> **Catatan lisensi:** Kode `rennzsync/baileys` sendiri berlisensi MIT, tapi bergantung pada `libsignal` (GPL-3.0) saat runtime untuk kripto Signal Protocol. Kalau kamu mau publish atau redistribusi package ini, cek dulu apa arti kepatuhan GPL-3.0 buat use case kamu — ini bukan nasihat hukum.

Fokus proyek: **bot WhatsApp multimedia** — pipeline audio, video, gambar, dan stiker, plus **Rich WebUI** (interface HTML inline yang dirender langsung di dalam bubble chat), dengan default yang hemat RAM.

---

## Fitur Unggulan

- **Full parity Baileys 7.0.0-rc14** — implementasi lengkap TC-token (trusted contact token dengan expiry & re-issue), Signal Repository API v7 (`getSessionInfo`, `hasSenderKey`, `getSenderKeyDistributionMessage`), format QR/pairing baru, penanganan reachout timelock.
- **Engine Signal Protocol standar** — pakai `libsignal` langsung, sama seperti stock Baileys rc14; nggak ada kripto native custom yang perlu di-maintain.
- **Pipeline multimedia terpusat** — utility `media-processor` (ffmpeg/sharp/audio-decode, lazy-loaded).
- **Rich WebUI** — render interface HTML/CSS/JS langsung di dalam bubble chat lewat `sendInlineWebUI`.
- **Widget & rich menu (10.5.0)** — `sock.sendA2UI` (widget A2UI), `sock.richMenu`, dan opsi kirim `viewOnceV2` / `viewOnceV2Extension`.
- **Hemat RAM secara default** — `syncFullHistory: false`, `enableRecentMessageCache: false`, TTL cache moderat.

---

## Requirement

| Requirement | Versi |
|---|---|
| Node.js | >= 20.0.0 |

Dukungan platform mengikuti apapun yang didukung `libsignal` (^6.0.0) di sistem kamu — cek dokumentasi package tersebut buat cakupan binary/platform prebuilt-nya.

---

## Instalasi

```bash
npm install @rennzsync/baileys
```

### Dependency opsional (install sesuai fitur yang dipakai)

| Package | Fitur |
|---|---|
| `audio-decode` | Waveform voice note (`ptt: true`) — **wajib buat voice note** |
| `sharp` | Resize/kompresi gambar |
| `fluent-ffmpeg` | Konversi video/audio, thumbnail video |
| `jimp` | Thumbnail alternatif (tanpa sharp) |
| `link-preview-js` | Preview link |

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

## Contoh: Multimedia

### Kirim gambar dengan caption

```js
await sock.sendMessage(jid, {
  image: { url: 'https://example.com/photo.jpg' },
  caption: 'Halo!'
});
```

### Kirim voice note (PTT)

```js
// butuh: npm install audio-decode
await sock.sendMessage(jid, {
  audio: { url: './voice.ogg' },
  mimetype: 'audio/ogg; codecs=opus',
  ptt: true
});
```

### Konversi video/audio sebelum dikirim (media-processor)

```js
import { convertToWhatsAppVideo, convertToOpusAudio, getVideoThumbnail, resizeImage } from '@rennzsync/baileys';

// Video apapun -> MP4/H.264 kompatibel WhatsApp (butuh fluent-ffmpeg)
const mp4 = await convertToWhatsAppVideo(rawBuffer);
await sock.sendMessage(jid, { video: mp4, caption: 'Video hasil konversi' });

// Audio apapun -> OGG/Opus buat voice note
const opus = await convertToOpusAudio(audioBuffer);

// Thumbnail video & resize gambar (butuh sharp)
const thumb = await getVideoThumbnail(mp4, 1);
const small = await resizeImage(imageBuffer, { width: 300, height: 300 });
```

### Cek metadata media

```js
import { probeMedia, getMp4Duration } from '@rennzsync/baileys';

const meta = await probeMedia(buffer, 'audio/mpeg'); // { duration, bitrate, container, codec }
const dur = getMp4Duration(mp4Buffer); // nggak butuh ffmpeg — parse atom langsung
```

---

## Contoh: Rich WebUI (HTML inline di bubble chat)

Kirim interface HTML/CSS/JS yang **dirender langsung di dalam bubble pesan** — cocok buat menu interaktif, mini-app, dan dashboard:

```js
import { sendInlineWebUI } from '@rennzsync/baileys';

const html = `<!DOCTYPE html>
<html><head><style>body{background:#111b21;color:#fff;font-family:sans-serif;padding:16px}</style></head>
<body><h2>Menu Bot</h2><button onclick="alert('hai')">Tekan aku</button></body></html>`;

await sendInlineWebUI(sock, jid, html, 'Menu Bot');

// Identitas bisa di-override (default: Meta AI)
await sendInlineWebUI(sock, jid, html, 'Menu Bot', {
  botJid: '12345@bot',
  forwardOrigin: 'CUSTOM'
});
```

> Catatan: nama primitive HTML-nya (`GenAIaeacdsnwHtmlPrimitive`) adalah identifier obfuscated dari WhatsApp Web dan bisa berubah antar versi WA. Kalau WebUI berhenti render, update identifier-nya dari bundle WA Web terbaru.

---

## Contoh: Button & list klasik (render di semua device, baru di 10.0.1)

Card `interactiveMessage` + `nativeFlowMessage` **udah nggak dirender** di banyak client WhatsApp — `relayMessage` sukses tanpa error tapi pesannya diam-diam nggak muncul. Template klasik `buttonsMessage` dan `listMessage` render dengan reliable di **semua** client (Android/iOS/Web/Desktop).

`@rennzsync/baileys@10.5.0` menyediakan builder siap pakai di `lib/Utils/rich-classic.js`:

```js
import { buildButtonsMessage, buildListMessage, sendClassicMessage } from '@rennzsync/baileys';

// 1-3 tombol quick-reply (opsional dengan header location+thumbnail)
const buttons = buildButtonsMessage({
  text: 'Halo Bro — pilih opsi',
  footer: '© My Bot',
  buttons: [
    { buttonId: '.owner', buttonText: 'Owner' },
    { buttonId: '.allmenu', buttonText: 'Allmenu' },
  ],
  locationMessage: { jpegThumbnail, name: 'My Bot', address: 'v10.0.1' },
});

// List scrollable dengan section dan row
const list = buildListMessage({
  title: 'Menu — 1271 command',
  description: 'Pilih kategori',
  buttonText: 'Pilih Kategori',
  sections: [{
    title: 'Kategori',
    rows: [
      { title: 'main', description: '19 command', rowId: '.menucat main' },
      { title: 'sticker', description: '42 command', rowId: '.menucat sticker' },
    ],
  }],
});

// Kirim lewat relayMessage — userJid dinormalisasi otomatis
// (nangani sock.user.id vs sock.user.jid yang legacy dan sebenarnya nggak pernah ada)
await sendClassicMessage(sock, jid, buttons);
await sendClassicMessage(sock, jid, list);
```

Juga meng-export `normalizeUserJid(sockOrUserOrJid)` — `sock.user.jid` nggak pernah ada di baileys 7.x (`sock.user` itu `creds.me`, yang punya `.id`); helper ini nerima bentuk apapun dan mengembalikan jid yang valid.

---

## Contoh: Carousel & native-flow button (baru di 10.0.3, perlu hati-hati)

`lib/Utils/rich-carousel.js` menambahkan builder `interactiveMessage`/`carouselMessage` (format card scroll horizontal), buat kasus di mana kamu butuh spesifik carousel atau tipe tombol CTA yang lebih kaya (`cta_url`, `cta_call`, `cta_copy`, `cta_reminder`, `single_select`) yang nggak dicakup template klasik di atas. Catatan rendering tetap sama: pakai `rich-classic.js` kecuali memang butuh yang ini.

```js
import { buildCarouselMessage, sendCarouselMessage, sendInteractiveMessage } from '@rennzsync/baileys';

// satu bubble native-flow (tanpa carousel)
await sendInteractiveMessage(sock, jid, {
  text: 'Pilih aksi:',
  footer: '© My Bot',
  buttons: [
    { type: 'quick_reply', displayText: 'Owner', id: '.owner' },
    { type: 'cta_url', displayText: 'Docs', url: 'https://github.com/RennZSync/baileys' },
  ],
});

// carousel multi-card
await sendCarouselMessage(sock, jid, {
  text: 'Pilih produk:',
  cards: [
    {
      header: { title: 'Produk A', mediaKind: 'thumbnail', jpegThumbnail },
      text: 'Rp 50.000',
      buttons: [{ type: 'quick_reply', displayText: 'Beli', id: 'buy_a' }],
    },
    {
      header: { title: 'Produk B', mediaKind: 'thumbnail', jpegThumbnail },
      text: 'Rp 75.000',
      buttons: [{ type: 'quick_reply', displayText: 'Beli', id: 'buy_b' }],
    },
  ],
});
```

`buildInteractiveCard(...)` dan `buildNativeFlowButton(...)` level rendah juga di-export kalau kamu mau object content mentahnya, bukan shortcut kirim.

---

## Foto profil ukuran penuh (baru di 10.0.3)

`generateProfilePicture` (dipakai oleh `updateProfilePicture` dan `newsletterUpdatePicture`) sekarang menerima `{ full: true }` buat skip crop paksa 640×640/quality-50 dan upload mendekati resolusi/kualitas asli:

```js
await sock.updateProfilePicture(sock.user.id, imageBuffer, { full: true }); // ~quality 92, tanpa resize
await sock.updateProfilePicture(sock.user.id, imageBuffer, { width: 1024, height: 1024, quality: 85 }); // custom
await sock.updateProfilePicture(sock.user.id, imageBuffer); // perilaku default tidak berubah (640x640, q50)
```

---

## Store in-memory / cache-manager & auth SQLite (baru di 10.1.0)

`lib/Store/*` menyediakan store chat/contact/message yang bisa dipasang ke `sock.ev`, plus dua backend auth-state:

```js
import makeWASocket, { makeInMemoryStore, useSqliteAuthState, useMultiFileAuthState } from '@rennzsync/baileys';

const store = makeInMemoryStore({});
store.readFromFile('./store.json');
setInterval(() => store.writeToFile('./store.json'), 10_000);

// Auth SQLite (butuh Node >= 22.5, node:sqlite bawaan — lempar error jelas di Node lama)
const { state, saveCreds } = await useSqliteAuthState('./auth.db');
// atau yang klasik berbasis file, tetap sama:
// const { state, saveCreds } = await useMultiFileAuthState('auth_info');

const sock = makeWASocket({ auth: state });
store.bind(sock.ev);
sock.ev.on('creds.update', saveCreds);
```

`makeCacheManagerAuthState` juga tersedia kalau kamu mau auth state di-backup pakai store `cache-manager` (peer dependency opsional, cuma dibutuhkan kalau benar-benar dipanggil).

`sock.sendMessage(jid, content, { isSecret, protected, me })` — tiga filter device/penerima tambahan yang di-port dari `@vansnowi/baileys`, diteruskan langsung ke `relayMessage`.

---

## Poll gambar (baru di 10.2.0)

Kirim poll di mana tiap opsinya berupa gambar, bukan teks biasa (`pollCreationMessageV3` dengan `pollContentType: IMAGE`, satu `pollCreationOptionImageMessage` per opsi, terhubung ke poll induk lewat `MEDIA_POLL`):

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

`hashImagePollOption(optionName, fileSha256)` juga di-export terpisah kalau kamu cuma butuh hash opsinya tanpa alur kirim lengkap. Catatan: ini implementasi sisi klien dari tipe pesan yang memang ada di proto WhatsApp tapi nggak ada fork Baileys manapun (termasuk upstream) yang menyediakan builder-nya — anggap eksperimental dan verifikasi rendering-nya di build client WA target kamu sebelum dipakai produksi.

---

## View Once V2 / V2 Extension (baru di 10.5.0)

```js
await sock.sendMessage(jid, { text: 'Pesan Rahasia', viewOnceV2Extension: true }) // viewOnceMessageV2Extension
await sock.sendMessage(jid, { text: 'Pesan Rahasia', viewOnceV2: true })          // viewOnceMessageV2
```

Pesan dibungkus ke `viewOnceMessageV2Extension` / `viewOnceMessageV2`; untuk teks, `viewOnce: true` di-set di dalam `extendedTextMessage`.

---

## Rich Menu (baru di 10.5.0, perlu hati-hati)

Port `richMenu` dari `@vansnowi/baileys` (juga diekspor sebagai `buildRichMenuMessage` / `sendRichMenu` dari `lib/Utils/rich-menu.js`). Tombolnya adalah CTA widget dengan toast, bukan quick-reply yang mengirim pesan balik. Pakai format GenAI `unifiedResponse` internal, jadi bisa saja tidak dirender di semua client WhatsApp.

```js
// tombol
await sock.richMenu(jid, {
  header: { title: 'Main Menu', image: { url: 'https://example.com/banner.png' } },
  body: { title: 'Pick one', buttons: ['Profile', 'Settings', 'Help'], toast: 'opening...' },
  footer: { text: 'Join us', url: 't.me/example' }
})

// kartu geser (carousel: true) / baris (row: true)
await sock.richMenu(jid, {
  body: {
    carousel: true,
    cards: [
      { title: 'Card 1', buttons: ['A', 'B'], toast: '...' },
      { title: 'Card 2', buttons: ['C', 'D'], toast: '...' }
    ]
  }
})
```

`footer.url` wajib diisi untuk tombol open-URL (tidak ada link default).

---

## Widget A2UI (baru di 10.5.0, perlu hati-hati)

Widget deklaratif (`Text`, `Image`, `Video`, `Button`, `Card`, `Column`, `Row`, `Divider`, `CheckBox`, `TextField`, `ChoicePicker`, plus `listCard`) yang dikirim sebagai `interactiveMessage.bloksWidget`. Diekspor juga sebagai `A2UI` / `sendA2UIWidget` dari `lib/Utils/a2ui.js`. Proto sekarang punya `InteractiveMessage.BloksWidget` (field 8). Format internal WhatsApp, jadi bisa tidak dirender di semua client.

```js
import { A2UI } from '@rennzsync/baileys'

const ui = new A2UI()
const title = ui.text('Halo!', { variant: 'h1' })
const label = ui.text('Klik saya')
const btn = ui.button(label, { action: { name: 'noop' } })
ui.root([ui.card(ui.column([title, btn]))])

await sock.sendA2UI(jid, { a2ui: ui, bodyText: 'Widget', footer: 'A2UI' })

// list card
const list = new A2UI().listCard({
  title: 'Menu',
  items: [{ title: 'Nasi Goreng', price: 'Rp15.000' }, { title: 'Es Teh', price: 'Rp5.000' }]
})
await sock.sendA2UI(jid, { a2ui: list, bodyText: 'Pesan menu' })
```

Opsi: `singleScreen`, `buttons` (native flow `{ name, params }`), `expiration`, `contextInfo`, `quoted`, `wrapped`, `type`.

---

## Konfigurasi Default (hemat RAM)

```js
const sock = makeWASocket({
  auth: state,
  // sudah hemat secara default; override kalau perlu:
  syncFullHistory: false,          // jangan tarik full chat history
  enableRecentMessageCache: false, // jangan simpan pesan terbaru di RAM
});
```

---

## Perubahan Besar dari 9.x (legacy renzsync-baileys)

- Base di-rebase ke Baileys **7.0.0-rc14**
- Modul yang dihapus: `lib/VoIP/*` (WebRTC call client), `Modded/message_builder.js`, `Utils/rich-messages.js`, `Socket/dugong.js`, `Utils/sticker-pack.js`.
  - `rejectCall` tetap tersedia (core `messages-recv`).
  - Pengganti rich messages lama: `rich-webui.js` (`sendInlineWebUI`, `buildWebuiMessage`).
- **10.0.1:** menambahkan `rich-classic.js` (`buildButtonsMessage`, `buildListMessage`, `sendClassicMessage`, `normalizeUserJid`) — card `interactiveMessage`/`nativeFlowMessage` udah nggak render di banyak client; pakai template klasik buat kompatibilitas maksimal.
- **10.0.2:** mengembalikan auto-inject node stanza `<biz>` dari ob9 (di-port dari ourin-baileys 9.0.21) — `relayMessage` sekarang otomatis melampirkan node interactive `biz` buat payload `buttonsMessage` / `listMessage` / `interactiveMessage`+`nativeFlowMessage`, kecuali si pemanggil udah menyediakan sendiri. Tanpa node ini server menerima stanza-nya tapi client penerima nggak pernah render card-nya (relay sukses diam-diam, pesan nggak pernah muncul). Ini regresi selama rebase ke Baileys 7 dan jadi akar masalah menu button/list yang invisible.
- **10.0.3:** menambahkan `rich-carousel.js` (`buildCarouselMessage`, `buildInteractiveMessage`, `buildInteractiveCard`, `buildNativeFlowButton`, `sendCarouselMessage`, `sendInteractiveMessage`) buat carousel card dan tombol CTA native-flow yang lebih kaya (`cta_url`/`cta_call`/`cta_copy`/`cta_reminder`/`single_select`). Juga memperluas `generateProfilePicture` (dan `updateProfilePicture` / `newsletterUpdatePicture`) dengan opsi `{ full: true }` buat upload foto profil di resolusi/kualitas asli, bukan downscale paksa 640×640 quality-50.
- **10.1.0:** menggabungkan `lib/Store/*` (in-memory store, cache-manager store, keyed-db/ordered-dictionary/object-repository) dari `@vansnowi/baileys`, plus `useSqliteAuthState` (node:sqlite bawaan Node 22.5+, dengan fallback error yang jelas di Node lama) dan filter kirim `isSecret`/`protected`/`me`-only yang dipasang ke `sock.sendMessage`.
- **10.2.0:** menambahkan `generateWAMessageFromImagePoll` / `hashImagePollOption` — builder sisi klien buat tipe pesan image-poll WhatsApp (`pollCreationMessageV3` + `pollCreationOptionImageMessage`, asosiasi `MEDIA_POLL`). Eksperimental — nggak ada fork Baileys upstream yang menyediakan ini.
- **10.5.0:** menambahkan opsi kirim `viewOnceV2` / `viewOnceV2Extension` (pesan dibungkus `viewOnceMessageV2` / `viewOnceMessageV2Extension`; untuk teks, `viewOnce: true` di-set di dalam `extendedTextMessage`); `sock.richMenu` (`rich-menu.js`: `buildRichMenuMessage`, `sendRichMenu` — tombol, kartu carousel/row, header gambar, footer open-URL) di-port dari `@vansnowi/baileys` tanpa link footer default bawaannya; widget A2UI (`a2ui.js`: `A2UI`, `sendA2UIWidget`, `sock.sendA2UI`) dikirim lewat `interactiveMessage.bloksWidget`, dengan `InteractiveMessage.BloksWidget` (field 8) ditambahkan ke WAProto (`WAProto.proto`, `index.js`, `index.d.ts`). `richMenu` dan A2UI memakai format internal WhatsApp, jadi bisa tidak dirender di semua client.
- Konfigurasi default berubah: `syncFullHistory` dan `enableRecentMessageCache` sekarang `false`.
- `protobufjs-cli` di-pin ke `^1.1.3` (fix konflik peer dependency); `link-preview-js` ke `^5.0.0` (fix advisory SSRF).
- **Rebrand:** package diganti nama jadi `@rennzsync/baileys`, sekarang dirawat oleh [RennZz-Dev](https://github.com/RennZSync). Nggak ada perubahan API — update import kamu dari `onigis` ke `@rennzsync/baileys`.
- **Engine Signal dikembalikan ke stock:** menghapus engine custom `@rennzsync/signal`/`@rennzsync/curve25519` (MIT, native Rust) dan kembali ke `libsignal` asli (GPL-3.0) yang dipakai stock Baileys rc14 — implementasi Signal Protocol yang sama, nggak ada lagi binary native custom yang perlu di-build/dikirim. Lihat catatan lisensi di bagian atas file ini.

---

## Testing

```bash
npm test 
```

Termasuk unit test buat: JID utils (PN/LID/hosted), Rich WebUI (build + roundtrip encode/decode proto).

---

## Kredit

- **[RennZz-Dev](https://github.com/RennZSync)** — maintainer `rennzsync/baileys`: rebrand, perawatan berkelanjutan & penyesuaian fokus bot
- **[WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys)** — library upstream & wrapper Signal Protocol asli (berbasis `libsignal`)

---

## Lisensi

**MIT** buat kode `rennzsync/baileys` sendiri — tapi bergantung pada `libsignal` (GPL-3.0) saat runtime untuk kripto Signal Protocol. Cek dulu apa artinya buat use case kamu sebelum redistribusi.
