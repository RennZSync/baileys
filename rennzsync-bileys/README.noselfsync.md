# ✨ noSelfSync — `@rennzsync/baileys`

[![Version](https://img.shields.io/badge/npm-10.5.2-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://www.npmjs.com/package/@rennzsync/baileys)

Send messages **without syncing them to the sender's own device**.
Kirim pesan **tanpa disinkronkan ke device pengirim**.

---

## 📦 Install

```bash
npm i @rennzsync/baileys
```

```js
import makeWASocket from '@rennzsync/baileys'
```

---

## 🚀 Usage

```js
await conn.sendMessage(m.chat, {
  text: "Test"
}, {
  noSelfSync: true
})
```

### 𝗢𝗽𝘁𝗶𝗼𝗻𝘀

| Value | Behavior |
|---|---|
| `true` | *Not visible on the sender device* — tidak terlihat di device pengirim |
| `false` (default) | *Visible on the sender device* — terlihat di device pengirim |

---

## 🧩 Examples

**Text**
```js
await conn.sendMessage(m.chat, { text: "Test" }, { noSelfSync: true })
```

**Image**
```js
await conn.sendMessage(m.chat, {
  image: { url: "https://example.com/pic.jpg" },
  caption: "Test"
}, { noSelfSync: true })
```

**Combined with other send options**
```js
await conn.sendMessage(m.chat, { text: "Test" }, {
  quoted: m,
  noSelfSync: true
})
```

**Normal (visible on sender device)**
```js
await conn.sendMessage(m.chat, { text: "Test" }, { noSelfSync: false })
// or simply omit the option
```

---

## ⚙️ How it works

When a 1:1 message is sent, WhatsApp normally encrypts a copy for every device of the recipient **and** for the sender's own other devices (phone / companions) — that copy is what makes the message appear on your own phone.

With `noSelfSync: true`, the sender's own other devices are skipped during encryption. The message is still delivered to the recipient, but no copy is synced to the sender's devices.

Implemented in `lib/Socket/messages-send.js` (`relayMessage` → `noSelfSync`), using the same recipient-filter pattern as `isSecret` / `protected` / `me`.

---

## ⚠️ Notes

- Works for **1:1 chats only**. In groups the sender-key flow is unchanged (skipping own devices there can cause decrypt/retry issues).
- Only affects **your own other devices** — the recipient receives the message normally.
- Default is `false`, so existing code behaves exactly as before.
- Delivery/read state is unaffected for the recipient.

---

## 📝 Changelog

- **10.5.2** — added `noSelfSync` send option.

---

## 🧰 Links

- GitHub: https://github.com/RennZSync/baileys
- npm: https://www.npmjs.com/package/@rennzsync/baileys
- Maintainer: [RennZSync](https://github.com/RennZSync)

---

## 🇮🇩 Ringkasan

`noSelfSync: true` → pesan tetap terkirim ke penerima, tapi **tidak muncul di HP/device pengirim**.
`noSelfSync: false` (default) → pesan terlihat di device pengirim seperti biasa.

Hanya untuk chat 1:1. Untuk grup, perilaku tidak berubah.
