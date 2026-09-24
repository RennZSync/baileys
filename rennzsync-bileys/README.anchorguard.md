# 🛡️ AnchorGuard — `@rennzsync/baileys`

[![Version](https://img.shields.io/badge/npm-10.6.0-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://www.npmjs.com/package/@rennzsync/baileys)

Anti **force-close / crash-bug** guard, built into `makeWASocket`.
Guard **anti force-close/crash-bug**, sudah menyatu di `makeWASocket`.

> Best-effort, bukan 100%. Seperti antivirus: menangkap pola crash yang dikenal + heuristik struktural. Bug baru butuh update. Baileys tidak merender UI, jadi bot bisa menghapus pesan racun sebelum HP/WA Web sempat membukanya.

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
const sock = makeWASocket({
  auth: state,
  AnchorGuard: true,
  AnchorGuardConfig: {
    blockOnBug: true,
    burstThreshold: 2,
    kickOnBurst: true,
    guardGroupAdds: true,
    metaAiNumbers: true
  }
})
```

Guard is attached automatically right after the socket is created and exposed as `sock.anchorGuard`. Call `sock.anchorGuard.stop()` to unhook it.

---

## ⚙️ Options (`AnchorGuardConfig`)

| Option | Default | Meaning |
|---|---|---|
| `autoDelete` | `true` | Auto-delete a message flagged as a bug |
| `deleteMode` | `'auto'` | `'auto'` = revoke if from us, delete-for-me if from someone else. `'everyone'` = always revoke. `'me'` = always delete-for-me |
| `guardIncoming` | `true` | Scan incoming messages (`messages.upsert`) |
| `guardOutgoing` | `true` | Sanitize outgoing messages (wraps `sock.sendMessage`; throws on a dangerous payload) |
| `blockOnBug` | `false` | Block the sender (`updateBlockStatus`) when a bug message arrives from someone else |
| `selfOnly` | `false` | Only guard chats with your own number |
| `ownJid` | `sock.user.id` | Your own JID |
| `thresholds` | `{}` | Override detection thresholds (see `ANCHORGUARD_DEFAULTS`) |
| `onDetect` | `null` | Callback fired when something is flagged |
| `proto` | `null` | Optional; pass Baileys' `proto` for round-trip protobuf-size validation |
| `burstThreshold` | `0` | Flag a sender once they exceed this many messages inside `burstWindowMs`; `0` disables burst checking |
| `burstWindowMs` | `4000` | Rolling window (ms) used by `burstThreshold` |
| `kickOnBurst` | `false` | Remove the sender from the group (`groupParticipantsUpdate`, needs bot admin) on burst |
| `guardGroupAdds` | `false` | Also watch `group-participants.update` and flag/kick an inviter who adds people in a burst pattern |
| `metaAiNumbers` | `false` | `true` = guard Meta AI's JIDs too; `false` (default) = ignore them |

> `burstThreshold`, `kickOnBurst`, `guardGroupAdds` and `metaAiNumbers` are **rennzsync/baileys additions** on top of upstream `@rexxhayanasi/elaina-anchorguard` — they didn't exist in the original module.

---

## 🔎 Manual detection

```js
import { detectBug } from '@rennzsync/baileys'

const { flagged, reasons } = detectBug(msg.message)
if (flagged) console.log('bug:', reasons)
```

`createAnchorGuard(sock, config)` is also exported directly if you'd rather attach it yourself instead of the `AnchorGuard`/`AnchorGuardConfig` socket options.

---

## 💥 Crash vectors caught

- Flood of **combining** (`̀`…) and **invisible/zero-width/RTL-override** characters
- Giant text/caption and excessive newlines
- **Mention bombs** (`mentionedJid` / `groupMentions` with huge counts)
- `nativeFlowMessage` / `listMessage` / `carouselMessage` with too many buttons/sections/rows/cards
- Broken or oversized `buttonParamsJson`
- Too-deep wrapper nesting (viewOnce/ephemeral/deviceSent/edited)
- Overly deep/large or **circular** message structures
- Encoded protobuf size over the limit (when `proto` is passed)
- **(rennzsync addition)** message-burst flood from one sender, and burst group-adds

---

## ⚠️ Notes

- For someone else's message, WhatsApp doesn't allow revoke; the guard falls back to delete-for-me.
- Tune `thresholds` if long-but-legitimate messages start false-positiving.
- `kickOnBurst` / `guardGroupAdds` need the bot to be a group admin to actually remove anyone — otherwise the flag/log still fires but the removal call fails silently (logged as a warning).
- Meta AI's JID is skipped by default; set `metaAiNumbers: true` to guard it too.

---

## 📝 Changelog

- **10.6.0** — added AnchorGuard (`AnchorGuard` / `AnchorGuardConfig` in `makeWASocket`, `lib/Utils/anchor-guard.js`, `sock.anchorGuard`), ported from `@rexxhayanasi/elaina-anchorguard`, plus the burst/group-add/Meta-AI extensions above.

---

## 🧰 Links

- GitHub: https://github.com/RennZSync/baileys
- npm: https://www.npmjs.com/package/@rennzsync/baileys
- Upstream module: https://github.com/rexxzyid/elaina-anchorguard
- Maintainer: [RennZSync](https://github.com/RennZSync)

---

## 🇮🇩 Ringkasan

`AnchorGuard: true` di `makeWASocket` mengaktifkan guard anti force-close: mendeteksi payload yang bisa bikin WhatsApp crash (flood karakter, bom mention, tombol/list/carousel kebanyakan, JSON tombol rusak, struktur terlalu dalam/circular), lalu otomatis menghapus pesannya dan (opsional) memblokir pengirim.

Tambahan khusus rennzsync/baileys (tidak ada di modul aslinya): `burstThreshold` + `kickOnBurst` (deteksi & kick banjir pesan dari satu pengirim) dan `guardGroupAdds` (deteksi banjir orang yang di-add ke grup). `metaAiNumbers: true` kalau mau nomor Meta AI ikut dijaga juga (default diabaikan).
