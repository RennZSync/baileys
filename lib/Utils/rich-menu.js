/**
 * rich-menu.js — menu "rich response" (tombol + kartu geser + header gambar +
 * footer open-URL) lewat botForwardedMessage > richResponseMessage >
 * unifiedResponse, porting dari @vansnowi/baileys (`richMenu`).
 *
 * PERINGATAN (sama seperti rich-webui.js / rich-carousel.js):
 * unifiedResponse adalah format GenAI internal WhatsApp — relayMessage bisa
 * sukses tanpa error walau pesan tidak dirender di client penerima, dan nama
 * typename-nya bisa berubah antar-versi WA. Tombol di sini adalah CTA widget
 * dengan toast, BUKAN quick-reply yang mengirim balik pesan ke bot.
 *
 * Content yang dikembalikan siap dipakai dengan
 * generateWAMessageFromContent(jid, content, { userJid }) lalu
 * relayMessage(jid, msg.message, { messageId: msg.key.id }).
 * Atau langsung: sock.richMenu(jid, content).
 */
import { randomBytes } from 'crypto';

const IMAGE_TTL_MS = 24 * 60 * 60 * 1000;
/** ForwardOrigin.META_AI di proto */
const FORWARD_ORIGIN_META_AI = 4;

const toolCallId = () => randomBytes(8).toString('hex');

const section = (viewModel) => ({
    __typename: 'GenAIUnifiedResponseSection',
    view_model: viewModel
});

const single = (primitive) => section({
    __typename: 'GenAISingleLayoutViewModel',
    primitive
});

/** Gambar inline: dirender lewat inline entity LaTeX 1 titik (trik agar gambar muncul di dalam teks). */
const inlineImagePrimitive = (image, { width, height, padding }) => ({
    __typename: 'GenAIMarkdownTextUXPrimitive',
    text: '{{header}}.{{/header}}',
    inline_entities: [
        {
            __typename: 'GenAITextInlineEntity',
            key: 'header',
            metadata: {
                __typename: 'GenAILatexItem',
                latex_expression: '.',
                font_height: 24,
                padding,
                latex_image: {
                    __typename: 'GenAIMediaItem',
                    mime_type: image.mime_type || 'image/png',
                    url: image.url,
                    url_fallback: image.url,
                    width: image.width || width,
                    height: image.height || height,
                    expiration_timestamp_ms: Date.now() + IMAGE_TTL_MS
                }
            }
        }
    ]
});

const normalizeButton = (btn, fallbackToast) => {
    const label = typeof btn === 'string' ? btn : btn?.label ?? btn?.text ?? '';
    const toast = typeof btn === 'object' && btn?.toast !== undefined ? btn.toast : fallbackToast;
    return {
        label: String(label),
        state: 'PENDING',
        kind: 'OTHER',
        tool_call_id: toolCallId(),
        toast: {
            label: toast || '',
            __typename: 'GenAI3PExtWidgetToast'
        },
        __typename: 'GenAI3PExtWidgetCTA'
    };
};

const widgetPrimitive = (title, buttons, toast) => ({
    __typename: 'GenAI3PExtWidgetPrimitive',
    header: {
        __typename: 'GenAI3PExtWidgetStandardHeader',
        title: title || ''
    },
    body: {
        __typename: 'GenAI3PExtCalendarEventList',
        ctas: buttons.map(btn => normalizeButton(btn, toast)),
        sections: []
    }
});

/**
 * Bangun content pesan rich menu (belum dikirim).
 *
 * @param {object} content
 * @param {object} [content.header]  { title, image: { url, inline, mime_type, width, height }, disclaimer, disclaimerText }
 * @param {object} [content.body]    { title, buttons: string[], toast } atau
 *                                   { carousel: true | row: true, cards: [{ title, buttons, toast }] }
 * @param {object} [content.footer]  { text, url, image: { url, mime_type, width, height } } — CTA open-URL hanya dibuat jika `url` diisi
 * @param {object} [content.contextInfo] override contextInfo richResponseMessage
 * @returns {object} content object (kompatibel proto.Message)
 */
export function buildRichMenuMessage(content = {}) {
    const { header, body, footer } = content;
    const sections = [];
    let messageContextInfo;
    if (header) {
        const { disclaimer = false, disclaimerText = ' ', image, title = '' } = header;
        if (disclaimer) {
            messageContextInfo = { botMetadata: { messageDisclaimerText: disclaimerText } };
        }
        if (title) {
            sections.push(single({ __typename: 'FOATextPrimitive', text: '# ' + title }));
        }
        if (image?.url) {
            if (image.inline) {
                sections.push(single(inlineImagePrimitive(image, { width: 500, height: 500, padding: 4 })));
            }
            else {
                sections.push(single({
                    __typename: 'GenAIImagePrimitive',
                    preview_image: {
                        __typename: 'GenAIMediaItem',
                        mime_type: image.mime_type || 'image/png',
                        url: image.url
                    },
                    full_image: {
                        __typename: 'GenAIMediaItem',
                        mime_type: image.mime_type || 'image/png',
                        url: image.url
                    }
                }));
            }
        }
    }
    if (body) {
        const { cards, buttons, title = '', toast = '', carousel = false, row = false } = body;
        if (carousel || row) {
            if (cards?.length) {
                sections.push(section({
                    __typename: carousel ? 'GenAIHScrollLayoutViewModel' : 'GenAIActionRowLayoutViewModel',
                    primitives: cards.map(card => widgetPrimitive(card?.title, card?.buttons || [], card?.toast))
                }));
            }
        }
        else if (buttons?.length) {
            sections.push(single(widgetPrimitive(title, buttons, toast)));
        }
    }
    if (footer) {
        const { text = '', url = '', image } = footer;
        const primitives = [];
        if (url) {
            primitives.push({
                __typename: 'GenAIFooterActionPrimitive',
                cta_text: text || 'Open',
                cta_type: 'OPEN_URL',
                cta_url: url
            });
        }
        if (image?.url) {
            primitives.push(inlineImagePrimitive(image, { width: 100, height: 100, padding: -5 }));
        }
        if (primitives.length) {
            sections.push({
                view_model: {
                    __typename: 'GenAIActionRowLayoutViewModel',
                    primitives
                }
            });
        }
    }
    if (!sections.length) {
        throw new TypeError('richMenu: header/body/footer kosong — isi minimal satu (title, image, buttons/cards, atau footer.url)');
    }
    return {
        ...(messageContextInfo ? { messageContextInfo } : {}),
        botForwardedMessage: {
            message: {
                richResponseMessage: {
                    unifiedResponse: {
                        data: Buffer.from(JSON.stringify({ sections })).toString('base64')
                    },
                    contextInfo: {
                        isForwarded: true,
                        forwardOrigin: FORWARD_ORIGIN_META_AI,
                        ...(content.contextInfo ?? {})
                    }
                }
            }
        }
    };
}

/**
 * Bangun + kirim rich menu lewat socket.
 * @param {object} sock  Baileys socket (harus punya relayMessage)
 * @param {string} jid   JID tujuan
 * @param {object} content lihat buildRichMenuMessage
 * @param {object} [options] { messageId }
 */
export async function sendRichMenu(sock, jid, content = {}, options = {}) {
    if (!sock || typeof sock.relayMessage !== 'function') {
        throw new TypeError('sendRichMenu: "sock" harus instance Baileys socket yang punya relayMessage()');
    }
    const message = buildRichMenuMessage(content);
    const messageId = options.messageId || ('3EB0' + randomBytes(18).toString('hex').toUpperCase());
    await sock.relayMessage(jid, message, { messageId });
    return { messageId, message };
}

export default { buildRichMenuMessage, sendRichMenu };
