/**
 * rich-carousel.js — pembangun pesan interactiveMessage (native flow button)
 * dan carouselMessage (kartu geser horizontal), menyusul permintaan fitur
 * yang ada di distribusi Baileys lain (mis. elaina-baileys).
 *
 * PERINGATAN (konsisten dengan audit di rich-classic.js):
 * interactiveMessage/nativeFlowMessage/carouselMessage TIDAK dijamin
 * dirender di semua client WhatsApp — relayMessage bisa sukses tanpa
 * error walau pesan tidak tampil di sisi penerima. Untuk kompatibilitas
 * maksimal (tombol/list yang pasti tampil), pakai buildButtonsMessage /
 * buildListMessage dari rich-classic.js. Modul ini disediakan untuk yang
 * butuh carousel/native-flow secara sadar risiko (mis. target client
 * WhatsApp Business App/terbaru yang terbukti mendukungnya).
 *
 * Helper di sini mengembalikan content object siap dipakai dengan
 * generateWAMessageFromContent(jid, content, { userJid }) lalu
 * relayMessage(jid, msg.message, { messageId: msg.key.id }).
 */
import { generateWAMessageFromContent } from './messages.js';

/**
 * Normalisasi 1 definisi tombol ringkas menjadi NativeFlowButton
 * ({ name, buttonParamsJson }) sesuai proto WhatsApp.
 *
 * Preset yang didukung lewat properti `type`:
 *  - 'quick_reply' (default): { displayText, id }
 *  - 'cta_url'   : { displayText, url, merchantUrl? }
 *  - 'cta_call'  : { displayText, phoneNumber }
 *  - 'cta_copy'  : { displayText, copyCode }
 *  - 'cta_reminder' : { displayText }
 *  - 'single_select' : { title, sections: [{title, rows:[{title,description?,id}]}] }
 *  - 'raw' : lolos apa adanya — { name, buttonParamsJson (string JSON) }
 */
export function buildNativeFlowButton(btn = {}) {
    if (btn.type === 'raw') {
        if (!btn.name) throw new Error('buildNativeFlowButton: raw butuh "name"');
        return {
            name: btn.name,
            buttonParamsJson: typeof btn.buttonParamsJson === 'string'
                ? btn.buttonParamsJson
                : JSON.stringify(btn.buttonParamsJson ?? {})
        };
    }
    const type = btn.type || 'quick_reply';
    switch (type) {
        case 'quick_reply':
            return {
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: btn.displayText,
                    id: btn.id
                })
            };
        case 'cta_url':
            return {
                name: 'cta_url',
                buttonParamsJson: JSON.stringify({
                    display_text: btn.displayText,
                    url: btn.url,
                    merchant_url: btn.merchantUrl || btn.url
                })
            };
        case 'cta_call':
            return {
                name: 'cta_call',
                buttonParamsJson: JSON.stringify({
                    display_text: btn.displayText,
                    phone_number: btn.phoneNumber
                })
            };
        case 'cta_copy':
            return {
                name: 'cta_copy',
                buttonParamsJson: JSON.stringify({
                    display_text: btn.displayText,
                    copy_code: btn.copyCode
                })
            };
        case 'cta_reminder':
            return {
                name: 'cta_reminder',
                buttonParamsJson: JSON.stringify({
                    display_text: btn.displayText
                })
            };
        case 'single_select':
            return {
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                    title: btn.title,
                    sections: (btn.sections || []).map((s) => ({
                        title: s.title,
                        rows: (s.rows || []).map((r) => ({
                            header: r.header,
                            title: r.title,
                            description: r.description,
                            id: r.id
                        }))
                    }))
                })
            };
        default:
            throw new Error(`buildNativeFlowButton: tipe tombol tidak dikenal "${type}"`);
    }
}

const buildHeader = (header) => {
    if (!header) return undefined;
    const h = { title: header.title, subtitle: header.subtitle, hasMediaAttachment: !!header.mediaKind };
    if (header.mediaKind === 'image' && header.imageMessage) h.imageMessage = header.imageMessage;
    if (header.mediaKind === 'video' && header.videoMessage) h.videoMessage = header.videoMessage;
    if (header.mediaKind === 'document' && header.documentMessage) h.documentMessage = header.documentMessage;
    if (header.mediaKind === 'thumbnail' && header.jpegThumbnail) h.jpegThumbnail = header.jpegThumbnail;
    return h;
};

/**
 * Bangun 1 objek InteractiveMessage — dipakai berdiri sendiri (native flow
 * biasa) ATAU sebagai 1 kartu di dalam carouselMessage.
 *
 * @param {object} options
 * @param {string} [options.text] - Body text.
 * @param {string} [options.footer]
 * @param {object} [options.header] - { title, subtitle, mediaKind: 'image'|'video'|'document'|'thumbnail', imageMessage|videoMessage|documentMessage|jpegThumbnail }
 *        Catatan: imageMessage/videoMessage/documentMessage di sini adalah
 *        payload proto media yang SUDAH di-upload (hasil generateWAMessage
 *        untuk media, ambil field .imageMessage dst dari .message-nya).
 * @param {Array<object>} [options.buttons] - Lihat buildNativeFlowButton.
 * @returns {object} InteractiveMessage plain object (bukan content wrapper).
 */
export function buildInteractiveCard({ text, footer, header, buttons = [] } = {}) {
    const im = {};
    const h = buildHeader(header);
    if (h) im.header = h;
    if (text) im.body = { text };
    if (footer) im.footer = { text: footer };
    if (buttons.length) {
        im.nativeFlowMessage = {
            buttons: buttons.map(buildNativeFlowButton),
            messageVersion: 1
        };
    }
    return im;
}

/**
 * Bangun content interactiveMessage (native flow) siap kirim — untuk 1
 * bubble tombol tanpa carousel.
 */
export function buildInteractiveMessage(options = {}) {
    return { interactiveMessage: buildInteractiveCard(options) };
}

/**
 * Bangun content carouselMessage — beberapa kartu geser horizontal,
 * masing-masing kartu adalah hasil buildInteractiveCard().
 *
 * @param {object} options
 * @param {string} [options.text] - Body text intro (di atas carousel).
 * @param {string} [options.footer]
 * @param {Array<object>} options.cards - Tiap elemen: parameter yang sama
 *        seperti buildInteractiveCard (header wajib diisi tiap kartu agar
 *        ada visual pembeda antar kartu).
 * @returns {object} content siap dipakai di generateWAMessageFromContent.
 */
export function buildCarouselMessage({ text, footer, cards = [] } = {}) {
    if (!cards.length) throw new Error('buildCarouselMessage: minimal 1 kartu');
    return {
        interactiveMessage: {
            ...(text ? { body: { text } } : {}),
            ...(footer ? { footer: { text: footer } } : {}),
            carouselMessage: {
                cards: cards.map((c) => buildInteractiveCard(c)),
                messageVersion: 1,
                carouselCardType: 1 // HSCROLL_CARDS
            }
        }
    };
}

/**
 * Shortcut: bangun & generate WAMessage sekaligus (native flow biasa).
 * @param {string} jid
 * @param {object} sock - instance socket (butuh sock.user untuk userJid).
 * @param {object} options - lihat buildInteractiveMessage.
 */
export async function sendInteractiveMessage(sock, jid, options = {}) {
    const content = buildInteractiveMessage(options);
    const msg = await generateWAMessageFromContent(jid, content, { userJid: sock.user?.id });
    await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
    return msg;
}

/**
 * Shortcut: bangun & generate WAMessage sekaligus (carousel).
 * @param {string} jid
 * @param {object} sock - instance socket (butuh sock.user untuk userJid).
 * @param {object} options - lihat buildCarouselMessage.
 */
export async function sendCarouselMessage(sock, jid, options = {}) {
    const content = buildCarouselMessage(options);
    const msg = await generateWAMessageFromContent(jid, content, { userJid: sock.user?.id });
    await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
    return msg;
}
