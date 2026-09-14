<div align="center">

# renz/baileys

**Library bot WhatsApp ringan — rebase penuh ke `@whiskeysockets/baileys` 7.0.0-rc14**

[![Version](https://img.shields.io/badge/npm-10.2.0-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://www.npmjs.com/package/@renz/baileys)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Baileys](https://img.shields.io/badge/Base-Baileys%207.0.0--rc14-blue?style=for-the-badge)](https://github.com/WhiskeySockets/Baileys)
[![License](https://img.shields.io/badge/License-MIT%20%2B%20GPL--3.0%20dep-blue?style=for-the-badge)](LICENSE)

**[Read in English → README.md](README.md)**

</div>

Library WhatsApp Multi-Device yang direbase penuh ke Baileys v7 rc14, memakai engine Signal Protocol asli (`libsignal`, GPL-3.0) — sama seperti yang dipakai stock `@whiskeysockets/baileys` rc14.

> **Catatan lisensi:** kode `renz/baileys` sendiri MIT, tapi bergantung ke `libsignal` (GPL-3.0) saat runtime buat crypto Signal Protocol-nya. Kalau mau publish/redistribusikan package ini, cek dulu implikasi kepatuhan GPL-3.0-nya buat kebutuhanmu — ini bukan nasihat hukum.

Fokus proyek ini: **bot WhatsApp multi-media** — kirim/terima audio, video, gambar, stiker, dan **Rich WebUI** (antarmuka HTML inline di dalam bubble chat), dengan konfigurasi default yang hemat RAM.

---

## Fitur Utama

- **Paritas Baileys 7.0.0-rc14** — TC-token lengkap (trusted contact token dengan expiry & re-issue), Signal Repository API v7 (`getSessionInfo`, `hasSenderKey`, `getSenderKeyDistributionMessage`), format QR/pairing terbaru, penanganan reachout timelock.
- **Engine Signal Protocol standar** — pakai `libsignal` langsung, sama seperti stock Baileys rc14; nggak ada native crypto custom yang perlu dirawat.
- **Pipeline multi-media terpusat** — utilitas `media-processor` (ffmpeg/sharp/audio-decode, lazy-load).
- **Rich WebUI** — render antarmuka HTML/CSS/JS langsung di bubble chat via `sendInlineWebUI`.
- **RAM-friendly by default** — `syncFullHistory: false`, `enableRecentMessageCache: false`, TTL cache moderat.

---

## Syarat

| Kebutuhan | Versi |
|---|---|
| Node.js | >= 20.0.0 |

Dukungan platform ngikutin apa yang didukung `libsignal` (^6.0.0) di sistemmu — cek dokumentasi package itu buat detail prebuilt binary/platform-nya.

---

## Instalasi

```bash
npm install @renz/baileys
```

### Dependency opsional (install sesuai fitur)

| Package | Untuk fitur |
|---|---|
| `audio-decode` | Waveform voice note (`ptt: true`) — **wajib untuk voice note** |
| `sharp` | Resize/kompres gambar |
| `fluent-ffmpeg` | Konversi video/audio, thumbnail video |
| `jimp` | Thumbnail alternatif (tanpa sharp) |
| `link-preview-js` | Link preview |

---

## Quick Start

```js
import makeWASocket, { useMultiFileAuthState } from '@renz/baileys';

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

## Contoh: Multi-Media

### Kirim gambar dengan caption

```js
await sock.sendMessage(jid, {
  image: { url: 'https://example.com/foto.jpg' },
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

### Konversi video/audio sebelum kirim (media-processor)

```js
import { convertToWhatsAppVideo, convertToOpusAudio, getVideoThumbnail, resizeImage } from '@renz/baileys';

// Video apapun -> MP4/H.264 kompatibel WhatsApp (butuh fluent-ffmpeg)
const mp4 = await convertToWhatsAppVideo(bufferMentah);
await sock.sendMessage(jid, { video: mp4, caption: 'Video terkonversi' });

// Audio apapun -> OGG/Opus untuk voice note
const opus = await convertToOpusAudio(bufferAudio);

// Thumbnail video & resize gambar (butuh sharp)
const thumb = await getVideoThumbnail(mp4, 1);
const small = await resizeImage(imageBuffer, { width: 300, height: 300 });
```

### Probe metadata media

```js
import { probeMedia, getMp4Duration } from '@renz/baileys';

const meta = await probeMedia(buffer, 'audio/mpeg'); // { duration, bitrate, container, codec }
const dur = getMp4Duration(mp4Buffer); // tanpa ffmpeg — parse atom langsung
```

---

## Contoh: Rich WebUI (HTML inline di bubble chat)

Kirim antarmuka HTML/CSS/JS yang **ter-render langsung di dalam pesan** — cocok untuk menu interaktif, mini-app, dashboard:

```js
import { sendInlineWebUI } from '@renz/baileys';

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

> Catatan: nama primitive HTML (`GenAIaeacdsnwHtmlPrimitive`) adalah identifier obfuscated WhatsApp Web dan bisa berubah antar versi. Jika WebUI berhenti ter-render, update identifier dari bundle WA Web terbaru.

---

## Store & auth SQLite (baru di 10.1.0)

`lib/Store/*` nyediain store chat/kontak/pesan yang bisa dicolok ke `sock.ev`, plus dua backend auth-state:

```js
import makeWASocket, { makeInMemoryStore, useSqliteAuthState, useMultiFileAuthState } from '@renz/baileys';

const store = makeInMemoryStore({});
store.readFromFile('./store.json');
setInterval(() => store.writeToFile('./store.json'), 10_000);

// Auth pakai SQLite (butuh Node >= 22.5, node:sqlite bawaan — throw error jelas di Node lebih lama)
const { state, saveCreds } = await useSqliteAuthState('./auth.db');
// atau tetap pakai yang berbasis file:
// const { state, saveCreds } = await useMultiFileAuthState('auth_info');

const sock = makeWASocket({ auth: state });
store.bind(sock.ev);
sock.ev.on('creds.update', saveCreds);
```

`makeCacheManagerAuthState` juga tersedia kalau mau nyimpen auth state pakai store `cache-manager` (peer dependency opsional, cuma wajib kalau beneran dipakai).

`sock.sendMessage(jid, content, { isSecret, protected, me })` — tiga filter device/recipient tambahan hasil port dari `@vansnowi/baileys`, langsung diteruskan ke `relayMessage`.

---

## Poll gambar (baru di 10.2.0)

Kirim poll yang tiap opsinya berupa gambar, bukan teks biasa (`pollCreationMessageV3` dengan `pollContentType: IMAGE`, satu `pollCreationOptionImageMessage` per opsi, terhubung ke poll induk lewat asosiasi `MEDIA_POLL`):

```js
import { generateWAMessageFromImagePoll } from '@renz/baileys';

await generateWAMessageFromImagePoll(jid, {
  name: 'Pilih gambar favorit',
  selectableCount: 1,
  options: [
    { name: 'Gambar 1', image: { url: 'https://example.com/1.jpg' } },
    { name: 'Gambar 2', image: { url: 'https://example.com/2.jpg' } },
  ]
}, (msg, opts) => sock.relayMessage(jid, msg, opts), { upload: sock.waUploadToServer });
```

`hashImagePollOption(optionName, fileSha256)` juga di-export terpisah kalau cuma butuh hash opsi tanpa flow kirim lengkap. Catatan: ini implementasi sisi-klien buat tipe pesan yang protonya udah ada di WhatsApp tapi belum ada fork Baileys manapun (termasuk upstream) yang bikin builder-nya — anggap eksperimental, coba dulu di WA client target sebelum dipakai produksi.

---

## Konfigurasi Default (RAM-friendly)

```js
const sock = makeWASocket({
  auth: state,
  // default sudah irit; override bila perlu:
  syncFullHistory: false,          // tidak menarik riwayat chat penuh
  enableRecentMessageCache: false, // tidak menyimpan pesan terbaru di RAM
});
```

---

## Breaking Changes dari 9.x (oktz-baileys lama)

- Base direbase ke Baileys **7.0.0-rc14** (bukan lagi ourin-baileys 9.0.21).
- Modul yang **dihapus**: `lib/VoIP/*` (call client WebRTC), `Modded/message_builder.js`, `Utils/rich-messages.js`, `Socket/dugong.js`, `Utils/sticker-pack.js`.
  - `rejectCall` tetap tersedia (core `messages-recv`).
  - Pengganti rich message lama: `rich-webui.js` (`sendInlineWebUI`, `buildWebuiMessage`).
- **Rebrand:** package berganti nama jadi `@renz/baileys`, kini dirawat oleh [RennZz-Dev](https://github.com/RennZSync). Tidak ada perubahan API — cukup ganti import dari `onigis` ke `@renz/baileys`.
- **Signal engine balik ke stock:** engine custom `@renz/signal`/`@renz/curve25519` (MIT, native Rust) dilepas, balik pakai `libsignal` (GPL-3.0) asli seperti stock Baileys rc14 — implementasi Signal Protocol sama, tanpa native binary custom lagi. Lihat catatan lisensi di bagian atas file ini.
- Default config berubah: `syncFullHistory` dan `enableRecentMessageCache` kini `false`.
- `protobufjs-cli` dipin ke `^1.1.3` (fix konflik peer dependency); `link-preview-js` ke `^5.0.0` (fix advisory SSRF).
- **10.1.0:** gabung `lib/Store/*` (in-memory store, cache-manager store, keyed-db/ordered-dictionary/object-repository) dari `@vansnowi/baileys`, plus `useSqliteAuthState` (Node 22.5+, `node:sqlite` bawaan, fallback error jelas di Node lama) dan filter kirim `isSecret`/`protected`/`me` di `sock.sendMessage`.
- **10.2.0:** tambah `generateWAMessageFromImagePoll` / `hashImagePollOption` — builder sisi-klien buat tipe pesan image-poll WhatsApp (`pollCreationMessageV3` + `pollCreationOptionImageMessage`, asosiasi `MEDIA_POLL`). Eksperimental — belum ada fork Baileys manapun yang punya ini.

---

## Testing

```bash
npm test
```

Termasuk unit test: JID utils (PN/LID/hosted), Rich WebUI (build + roundtrip proto encode/decode).

---

## Kredit

- **[RennZz-Dev](https://github.com/RennZSync)** — maintainer `renz/baileys`: rebrand, perawatan & penyesuaian untuk kebutuhan bot
- **[KzorArsuy](https://github.com/rozzak2009)** — audit, rebase rc14, optimasi, multimedia & WebUI
- **[WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys)** — upstream library & wrapper Signal Protocol asli (berbasis `libsignal`)

---

## Lisensi

**MIT** untuk kode `renz/baileys` sendiri — tapi bergantung ke `libsignal` (GPL-3.0) saat runtime buat crypto Signal Protocol. Cek dulu implikasinya buat kebutuhanmu sebelum redistribusi.
