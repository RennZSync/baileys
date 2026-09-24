/**
 * rich-webui.js — kirim antarmuka HTML inline (WebUI) di dalam bubble chat WhatsApp.
 *
 * Mekanisme (hasil audit Desktop/botwhatsapp, terbukti berjalan):
 *   botForwardedMessage > message > richResponseMessage > unifiedResponse.data
 *   unifiedResponse.data = base64(JSON) dengan primitive GenAIaeacdsnwHtmlPrimitive.
 *
 * Modul ini sengaja ringan dan bebas native dependency:
 * hanya memakai node:crypto (tidak import generics.js/crypto.js),
 * sehingga aman di-load di semua platform.
 */
import { randomBytes, randomUUID } from 'crypto';

/** Nama primitive HTML (identifier obfuscated dari WA Web — bisa berubah antar-versi WA) */
export const WEBUI_PRIMITIVE_TYPENAME = 'GenAIaeacdsnwHtmlPrimitive';

/** Identitas default: forward dari Meta AI (terbukti di-render app resmi) */
export const DEFAULT_BOT_JID = '867051314767696@bot';
export const DEFAULT_FORWARD_ORIGIN = 'META_AI';

/** Batas aman ukuran payload HTML per pesan */
export const WEBUI_MAX_PAYLOAD_BYTES = 64 * 1024;

/** Generate message ID format WhatsApp (sama seperti generateMessageID, tapi tanpa import berat) */
export const generateWebuiMessageId = () => '3EB0' + randomBytes(18).toString('hex').toUpperCase();

/**
 * Bangun objek pesan WebUI (belum dikirim) — bisa dipakai untuk relayMessage manual.
 *
 * @param {object} options
 * @param {string} options.html - HTML standalone (semua CSS/JS inline). WAJIB.
 * @param {string} [options.title='WebUI'] - Teks fallback di submessage.
 * @param {string} [options.botJid='867051314767696@bot'] - Identitas bot penerus.
 * @param {string} [options.forwardOrigin='META_AI'] - Origin forward.
 * @param {string} [options.responseId] - UUID custom (default: random).
 * @returns {object} objek pesan siap encode (kompatibel proto.Message rc14)
 */
export function buildWebuiMessage({
    html,
    title = 'WebUI',
    botJid = DEFAULT_BOT_JID,
    forwardOrigin = DEFAULT_FORWARD_ORIGIN,
    responseId
} = {}) {
    if (typeof html !== 'string' || html.length === 0) {
        throw new TypeError('buildWebuiMessage: "html" wajib berupa string non-kosong');
    }
    const htmlBytes = Buffer.byteLength(html, 'utf-8');
    if (htmlBytes > WEBUI_MAX_PAYLOAD_BYTES) {
        console.warn(`[rich-webui] payload HTML ${htmlBytes} bytes melebihi batas aman ${WEBUI_MAX_PAYLOAD_BYTES} bytes — pesan berisiko ditolak server`);
    }
    const uuid = responseId || randomUUID();
    const unifiedResponse = {
        response_id: uuid,
        sections: [
            {
                view_model: {
                    primitive: {
                        __typename: WEBUI_PRIMITIVE_TYPENAME,
                        payload: html,
                        trusted_sources: []
                    },
                    __typename: 'GenAISingleLayoutViewModel'
                }
            }
        ]
    };
    const base64Data = Buffer.from(JSON.stringify(unifiedResponse), 'utf-8').toString('base64');
    return {
        messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
            botMetadata: {
                botResponseId: uuid
            }
        },
        botForwardedMessage: {
            message: {
                richResponseMessage: {
                    messageType: 'AI_RICH_RESPONSE_TYPE_STANDARD',
                    submessages: [
                        {
                            messageType: 'AI_RICH_RESPONSE_TEXT',
                            messageText: title
                        }
                    ],
                    unifiedResponse: {
                        data: base64Data
                    },
                    contextInfo: {
                        forwardingScore: 1,
                        isForwarded: true,
                        forwardedAiBotMessageInfo: {
                            botJid
                        },
                        forwardOrigin
                    }
                }
            }
        }
    };
}

/**
 * Bangun + kirim pesan WebUI langsung ke JID.
 *
 * @param {object} sock - Instance Baileys socket (harus punya relayMessage)
 * @param {string} jid - JID tujuan
 * @param {string} html - HTML standalone
 * @param {string} [title='WebUI'] - Teks fallback
 * @param {object} [options] - override: botJid, forwardOrigin, responseId, messageId
 * @returns {Promise<{ messageId: string, message: object }>}
 */
export async function sendInlineWebUI(sock, jid, html, title = 'WebUI', options = {}) {
    if (!sock || typeof sock.relayMessage !== 'function') {
        throw new TypeError('sendInlineWebUI: "sock" harus instance Baileys socket yang punya relayMessage()');
    }
    const { messageId: customMessageId, ...buildOptions } = options;
    const message = buildWebuiMessage({ html, title, ...buildOptions });
    const messageId = customMessageId || generateWebuiMessageId();
    await sock.relayMessage(jid, message, { messageId });
    return { messageId, message };
}

export default {
    buildWebuiMessage,
    sendInlineWebUI,
    generateWebuiMessageId,
    WEBUI_PRIMITIVE_TYPENAME,
    DEFAULT_BOT_JID,
    DEFAULT_FORWARD_ORIGIN,
    WEBUI_MAX_PAYLOAD_BYTES
};
