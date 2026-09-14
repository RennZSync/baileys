/**
 * rich-classic.js — pembangun pesan format klasik yang stabil dirender
 * di SEMUA client WhatsApp (Android/iOS/Web/Desktop), tanpa wrapper
 * tambahan apa pun.
 *
 * Latar belakang (hasil audit render di produksi):
 *   - interactiveMessage + nativeFlowMessage (dibungkus viewOnceMessage
 *     atau tidak) TIDAK dirender lagi di banyak client — relayMessage
 *     sukses tanpa error tapi pesan tidak tampil. Jebakan klasik: tidak
 *     ada feedback error dari server.
 *   - buttonsMessage dan listMessage adalah template bawaan WhatsApp
 *     sejak awal dan tetap dirender di semua client. nativeFlowMessage
 *     hanya untuk tombol di dalam interactiveMessage.
 *
 * Helper di sini mengembalikan content object siap dipakai dengan
 * generateWAMessageFromContent(jid, content, { userJid }) lalu
 * relayMessage(jid, msg.message, { messageId: msg.key.id }).
 */
import { generateWAMessageFromContent } from './messages.js';

/**
 * Normalisasi userJid.
 *
 * Sock user di baileys 7.x adalah authState.creds.me yang memiliki .id
 * (bukan .jid). Banyak kode lama memakai sock.user.jid yang selalu
 * undefined, membuat participant pesan grup menjadi null dan pesan
 * tidak terkirim dengan benar. Helper ini menerima bentuk apa pun
 * (userJid langsung / objek sock / objek user) dan mengembalikan
 * jid string yang valid, atau undefined.
 */
export function normalizeUserJid(source) {
    if (!source) return undefined;
    if (typeof source === 'string') return source;
    // objek sock: pakai creds.me.id
    if (source.user?.id) return source.user.id;
    // objek user langsung
    if (source.id) return source.id;
    return undefined;
}

/**
 * Bangun content buttonsMessage (kartu tombol klasik, maks 3 tombol).
 *
 * @param {object} options
 * @param {string} options.text - Isi kartu (support formatasi WA).
 * @param {string} [options.footer] - Teks footer.
 * @param {Array<{buttonId:string, buttonText:string}>} options.buttons - 1-3 tombol.
 * @param {object} [options.locationMessage] - Header lokasi+thumbnail
 *        ({ jpegThumbnail, name, address }) — headerType 6.
 * @returns {object} content siap dipakai di generateWAMessageFromContent.
 */
export function buildButtonsMessage({ text, footer, buttons = [], locationMessage }) {
    if (!text) throw new Error('buildButtonsMessage: text wajib diisi');
    if (!buttons.length) throw new Error('buildButtonsMessage: minimal 1 tombol');
    if (buttons.length > 3) throw new Error('buildButtonsMessage: maksimal 3 tombol');
    const content = {
        buttonsMessage: {
            buttons: buttons.map((b) => ({
                buttonId: b.buttonId,
                buttonText: { displayText: b.buttonText },
                type: 1,
            })),
            contentText: text,
            headerType: locationMessage ? 6 : 1,
        },
    };
    if (footer) content.buttonsMessage.footerText = footer;
    if (locationMessage) content.buttonsMessage.locationMessage = locationMessage;
    return content;
}

/**
 * Bangun content listMessage (daftar pilihan klasik).
 *
 * @param {object} options
 * @param {string} options.title - Judul list.
 * @param {string} [options.description] - Deskripsi di bawah judul.
 * @param {string} options.buttonText - Label tombol pembuka list.
 * @param {Array<{title:string, rows:Array<{title:string,description?:string,rowId:string}>}>} options.sections
 * @returns {object} content siap dipakai di generateWAMessageFromContent.
 */
export function buildListMessage({ title, description, buttonText, sections = [] }) {
    if (!title) throw new Error('buildListMessage: title wajib diisi');
    if (!buttonText) throw new Error('buildListMessage: buttonText wajib diisi');
    if (!sections.length) throw new Error('buildListMessage: minimal 1 section');
    return {
        listMessage: {
            title,
            description: description || '',
            buttonText,
            listType: 2,
            sections: sections.map((s) => ({
                title: s.title,
                rows: s.rows.map((r) => ({
                    title: r.title,
                    description: r.description || '',
                    rowId: r.rowId,
                })),
            })),
        },
    };
}

/**
 * Kirim content klasik (buttonsMessage/listMessage) via relayMessage.
 * Mengembalikan { messageId } hasil pengiriman.
 *
 * CATATAN PENTING: pesan dikirim TANPA opsi quoted. Menambahkan quoted
 * pada template message klasik menyebabkan beberapa client menganggap
 * pesan sebagai reply dan menolak render tombolnya.
 */
export async function sendClassicMessage(sock, jid, content, options = {}) {
    const userJid = normalizeUserJid(options.userJid ?? sock);
    const msg = await generateWAMessageFromContent(jid, content, { userJid });
    await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
    return { messageId: msg.key.id, message: msg.message };
}

export default {
    normalizeUserJid,
    buildButtonsMessage,
    buildListMessage,
    sendClassicMessage,
};
