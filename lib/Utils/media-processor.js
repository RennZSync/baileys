/**
 * media-processor.js — utilitas media terpusat untuk bot WhatsApp multi-media.
 *
 * Semua dependency berat (sharp, fluent-ffmpeg, audio-decode) di-load secara
 * LAZY (dynamic import) sehingga proses yang tidak memakai fitur media tidak
 * membayar biaya RAM-nya. Jika package opsional tidak terpasang, fungsi yang
 * membutuhkannya melempar error yang jelas.
 */
import { PassThrough, Readable } from 'stream';

const loadSharp = async () => {
    try {
        return (await import('sharp')).default;
    }
    catch {
        throw new Error('Package "sharp" tidak terpasang. Jalankan: npm install sharp');
    }
};

const loadFfmpeg = async () => {
    try {
        return (await import('fluent-ffmpeg')).default;
    }
    catch {
        throw new Error('Package "fluent-ffmpeg" tidak terpasang. Jalankan: npm install fluent-ffmpeg');
    }
};

const bufferToStream = (buffer) => {
    const stream = new Readable({ read() { } });
    stream.push(buffer);
    stream.push(null);
    return stream;
};

const ffmpegToBuffer = (ffmpeg, input, outputOptions, extraArgs = []) => new Promise((resolve, reject) => {
    const output = new PassThrough();
    const chunks = [];
    output.on('data', (chunk) => chunks.push(chunk));
    output.on('end', () => resolve(Buffer.concat(chunks)));
    output.on('error', reject);
    ffmpeg(bufferToStream(input))
        .outputOptions([...outputOptions, ...extraArgs])
        .on('error', (err) => reject(new Error(`ffmpeg error: ${err.message}`)))
        .pipe(output, { end: true });
});

/** Resize/kompres gambar via sharp. fit: 'cover' | 'contain' | 'inside' ... */
export const resizeImage = async (buffer, { width = 300, height = 300, fit = 'cover', format = 'jpeg', quality } = {}) => {
    const sharp = await loadSharp();
    let pipeline = sharp(buffer).resize(width, height, { fit, position: 'center', background: { r: 0, g: 0, b: 0, alpha: 0 } });
    if (format === 'png') {
        pipeline = pipeline.png();
    }
    else if (format === 'webp') {
        pipeline = pipeline.webp(quality ? { quality } : {});
    }
    else {
        pipeline = pipeline.jpeg(quality ? { quality } : {});
    }
    return pipeline.toBuffer();
};

/** Konversi video ke format kompatibel WhatsApp (MP4/H.264 + AAC). */
export const convertToWhatsAppVideo = async (buffer, { maxWidth = 1280, videoBitrate = '1000k', audioBitrate = '128k' } = {}) => {
    const ffmpeg = await loadFfmpeg();
    return ffmpegToBuffer(ffmpeg, buffer, [
        '-c:v libx264',
        '-preset fast',
        '-profile:v baseline',
        '-level 3.0',
        `-vf scale='min(${maxWidth},iw)':-2`,
        `-b:v ${videoBitrate}`,
        '-c:a aac',
        `-b:a ${audioBitrate}`,
        '-movflags +faststart',
        '-f mp4'
    ]);
};

/** Konversi audio apapun ke OGG/Opus (format voice note WhatsApp). */
export const convertToOpusAudio = async (buffer, { bitrate = '32k', channels = 1, sampleRate = 48000 } = {}) => {
    const ffmpeg = await loadFfmpeg();
    return ffmpegToBuffer(ffmpeg, buffer, [
        '-c:a libopus',
        `-b:a ${bitrate}`,
        `-ac ${channels}`,
        `-ar ${sampleRate}`,
        '-application voip',
        '-f ogg'
    ]);
};

/** Ambil satu frame video sebagai thumbnail JPEG. */
export const getVideoThumbnail = async (buffer, timeSec = 0, { width = 300, height = 300 } = {}) => {
    const ffmpeg = await loadFfmpeg();
    const frame = await ffmpegToBuffer(ffmpeg, buffer, [
        `-ss ${timeSec}`,
        '-vframes 1',
        '-vcodec png',
        '-f image2pipe'
    ]);
    return resizeImage(frame, { width, height, format: 'jpeg' });
};

/** Metadata media (durasi, dimensi, format) via music-metadata (audio) atau ffprobe fallback. */
export const probeMedia = async (buffer, mimeType = '') => {
    try {
        const { parseBuffer } = await import('music-metadata');
        const meta = await parseBuffer(buffer, { mimeType: mimeType || undefined }, { duration: true });
        return {
            duration: meta.format.duration,
            bitrate: meta.format.bitrate,
            container: meta.format.container,
            codec: meta.format.codec
        };
    }
    catch (error) {
        throw new Error(`probeMedia gagal: ${error.message}`);
    }
};

/** Durasi MP4 tanpa ffmpeg — parse atom moov/mvhd langsung. */
export const getMp4Duration = (buffer, { silent = true } = {}) => {
    try {
        if (!Buffer.isBuffer(buffer) || buffer.length < 8) {
            if (silent) return 0;
            throw new Error('Invalid buffer');
        }
        let offset = 0;
        while (offset < buffer.length - 8) {
            const size = buffer.readUInt32BE(offset);
            if (size < 8 || offset + size > buffer.length) {
                if (silent) return 0;
                throw new Error('Invalid atom size');
            }
            const type = buffer.toString('ascii', offset + 4, offset + 8);
            if (type === 'moov') {
                let moovOffset = offset + 8;
                const moovEnd = offset + size;
                while (moovOffset < moovEnd - 8) {
                    const childSize = buffer.readUInt32BE(moovOffset);
                    if (childSize < 8 || moovOffset + childSize > moovEnd) {
                        if (silent) return 0;
                        throw new Error('Invalid child atom size');
                    }
                    const childType = buffer.toString('ascii', moovOffset + 4, moovOffset + 8);
                    if (childType === 'mvhd') {
                        const version = buffer.readUInt8(moovOffset + 8);
                        if (version === 0) {
                            const timescale = buffer.readUInt32BE(moovOffset + 20);
                            const duration = buffer.readUInt32BE(moovOffset + 24);
                            return timescale ? duration / timescale : 0;
                        }
                        if (version === 1) {
                            const timescale = buffer.readUInt32BE(moovOffset + 32);
                            const duration = Number(buffer.readBigUInt64BE(moovOffset + 36));
                            return timescale ? duration / timescale : 0;
                        }
                    }
                    moovOffset += childSize;
                }
            }
            offset += size;
        }
        if (silent) return 0;
        throw new Error('No mvhd found!');
    }
    catch (err) {
        if (silent) return 0;
        throw err;
    }
};
