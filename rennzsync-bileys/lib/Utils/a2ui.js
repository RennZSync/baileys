/**
 * a2ui.js — widget A2UI (Agent-to-UI) lewat interactiveMessage.bloksWidget.
 *
 * Builder deklaratif (Text, Image, Video, Button, Card, Column, Row, Divider,
 * CheckBox, TextField, ChoicePicker) + listCard, lalu dikirim sebagai
 * interactiveMessage dengan field bloksWidget (proto field 8) dan node <biz>
 * native_flow.
 *
 * PERINGATAN (sama seperti rich-*.js): format ini internal WhatsApp dan tidak
 * dijamin dirender di semua client — relayMessage bisa sukses tanpa error
 * walau widget tidak tampil di sisi penerima.
 *
 * Pakai:
 *   const ui = new A2UI()
 *   const t = ui.text('Halo', { variant: 'h1' })
 *   ui.root([t])
 *   await sock.sendA2UI(jid, { a2ui: ui, bodyText: 'Widget' })
 *   // atau: sendA2UIWidget(sock, jid, { a2ui: ui })
 */
import { randomBytes, randomUUID } from 'crypto';

const DEFAULT_CATALOG_ID = 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json';

export class A2UI {
    constructor({ catalogId = DEFAULT_CATALOG_ID, version = 'v0.9' } = {}) {
        this._version = version;
        this._catalogId = catalogId;
        this._components = new Map();
        this._counter = 0;
        this._rootChildren = [];
    }
    #nextId(prefix) {
        return `${prefix}_${(this._counter++).toString(36)}`;
    }
    #reg(id, component, extra = {}) {
        id ??= this.#nextId(component.toLowerCase());
        if (this._components.has(id))
            throw new Error(`Component id "${id}" already used`);
        this._components.set(id, { id, component, ...extra });
        return id;
    }
    text(text, { id, variant = 'body' } = {}) {
        return this.#reg(id, 'Text', { text, variant });
    }
    image(url, { id, variant, fit = 'cover' } = {}) {
        return this.#reg(id, 'Image', { url, ...(variant ? { variant } : {}), fit });
    }
    video(url, { id } = {}) {
        return this.#reg(id, 'Video', { url });
    }
    checkbox(label, { id, value = false } = {}) {
        return this.#reg(id, 'CheckBox', { label, value });
    }
    textField(label, { id, variant = 'text' } = {}) {
        return this.#reg(id, 'TextField', { label, variant });
    }
    button(childId, { id, variant = 'primary', action } = {}) {
        if (!childId)
            throw new TypeError('button(childId) requires the id of a child component (e.g. from .text())');
        return this.#reg(id, 'Button', { child: childId, variant, ...(action ? { action } : {}) });
    }
    card(childId, { id } = {}) {
        return this.#reg(id, 'Card', { child: childId });
    }
    column(children = [], { id, justify, align } = {}) {
        if (!children.length)
            throw new TypeError('column(children) requires at least one child id');
        return this.#reg(id, 'Column', { children, ...(justify ? { justify } : {}), ...(align ? { align } : {}) });
    }
    row(children = [], { id } = {}) {
        if (!children.length)
            throw new TypeError('row(children) requires at least one child id');
        return this.#reg(id, 'Row', { children });
    }
    divider({ id } = {}) {
        return this.#reg(id, 'Divider', {});
    }
    choicePicker(label, options, { id, variant = 'mutuallyExclusive', value, displayStyle = 'checkbox', filterable = false } = {}) {
        if (!Array.isArray(options) || !options.length) {
            throw new TypeError('choicePicker(label, options) requires a non-empty options array of {label, value}');
        }
        return this.#reg(id, 'ChoicePicker', {
            label,
            variant,
            ...(value !== undefined ? { value } : {}),
            options,
            displayStyle,
            filterable
        });
    }
    root(children) {
        if (!Array.isArray(children) || !children.length) {
            throw new TypeError('root(children) requires a non-empty array of top-level component ids');
        }
        this._rootChildren = children;
        return this;
    }
    listCard({ title, items, fallbackText, uuid = randomUUID() } = {}) {
        if (!title)
            throw new TypeError('listCard requires a title');
        if (!Array.isArray(items) || !items.length) {
            throw new TypeError('listCard requires a non-empty items array');
        }
        this._listCardPayload = {
            uuid,
            data: JSON.stringify({
                type: 'list_card',
                title,
                fallback_text: fallbackText ?? '',
                items: items.map(it => ({
                    asset_id: it.assetId ?? randomUUID().replace(/-/g, '').slice(0, 17),
                    asset_type: it.assetType ?? 'PRODUCT_ITEM',
                    title: it.title,
                    trailing_label: it.price ?? it.trailingLabel ?? '',
                    trailing_emphasis: it.emphasis ?? 'strong'
                }))
            }),
            type: 'im_a2ui',
            fallback: fallbackText ?? ''
        };
        return this;
    }
    build({ uuid = randomUUID(), surfaceId, type = 'im_a2ui', wrapped = true } = {}) {
        if (this._listCardPayload)
            return this._listCardPayload;
        if (!this._rootChildren.length)
            throw new Error('Call root([...ids]) before build()');
        const root = { id: 'root', component: 'Column', children: this._rootChildren };
        const components = [root, ...this._components.values()];
        const data = wrapped
            ? {
                version: this._version,
                createSurface: {
                    surfaceId: surfaceId ?? `starcore-widget=${uuid}`,
                    catalogId: this._catalogId,
                    components
                }
            }
            : { components };
        return {
            uuid,
            data: JSON.stringify(data),
            type
        };
    }
}

/** Ambil jid user dari sock / objek user / string (sama seperti normalizeUserJid di rich-classic.js). */
const resolveUserJid = (client) => client?.user?.id || client?.authState?.creds?.me?.id;

/**
 * Kirim widget A2UI.
 * @param {object} client  socket (butuh relayMessage; opsional user.id)
 * @param {string} jid
 * @param {object} options { a2ui, bodyText, footer, buttons, contextInfo, expiration, quoted, type, wrapped, singleScreen }
 */
export async function sendA2UIWidget(client, jid, { a2ui, bodyText = '', footer = '', buttons = [], contextInfo = {}, expiration, quoted, type = 'im_a2ui', wrapped = true, singleScreen = false } = {}) {
    if (!client || typeof client.relayMessage !== 'function')
        throw new Error('Socket is required');
    if (!(a2ui instanceof A2UI))
        throw new TypeError('a2ui must be an A2UI instance');
    const { generateWAMessageFromContent } = await import('./messages.js');
    const nativeFlowMessage = buttons && buttons.length
        ? {
            buttons: buttons.map(b => ({
                name: b.name ?? 'cta_url',
                buttonParamsJson: typeof b.params === 'string' ? b.params : JSON.stringify(b.params ?? {})
            })),
            messageParamsJson: '{}',
            messageVersion: 1
        }
        : { messageParamsJson: '' };
    const ctx = expiration || Object.keys(contextInfo).length
        ? { contextInfo: { ...(expiration ? { expiration } : {}), ...contextInfo } }
        : {};
    const interactiveMessage = singleScreen
        ? {
            nativeFlowMessage,
            bloksWidget: a2ui.build({ type, wrapped }),
            ...ctx
        }
        : {
            ...(footer !== undefined ? { header: { hasMediaAttachment: false } } : {}),
            ...(bodyText !== undefined ? { body: { text: bodyText } } : {}),
            ...(footer !== undefined ? { footer: { text: footer } } : {}),
            nativeFlowMessage,
            bloksWidget: a2ui.build({ type, wrapped }),
            ...ctx
        };
    const msg = generateWAMessageFromContent(jid, {
        messageContextInfo: { messageSecret: randomBytes(32) },
        interactiveMessage
    }, { quoted, userJid: resolveUserJid(client) });
    await client.relayMessage(msg.key.remoteJid, msg.message, {
        messageId: msg.key.id,
        additionalNodes: [
            {
                tag: 'biz',
                attrs: { actual_actors: '2', host_storage: '2', privacy_mode_ts: String(Math.floor(Date.now() / 1e3)) },
                content: [
                    { tag: 'interactive', attrs: { type: 'native_flow', v: '1' }, content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }] },
                    { tag: 'quality_control', attrs: { decision_id: randomUUID().replace(/-/g, ''), source_type: 'third_party' }, content: [{ tag: 'decision_source', attrs: { value: 'df' } }] }
                ]
            }
        ]
    });
    return msg;
}

export default { A2UI, sendA2UIWidget };
