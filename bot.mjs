import 'dotenv/config';
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import { GoogleGenAI } from '@google/genai';

// Ambil API Key dari file .env
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey || apiKey === 'TEMPEL_API_KEY_GEMINI_DI_SINI') {
    console.error('❌ GEMINI_API_KEY belum diatur! Edit file .env terlebih dahulu.');
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // Tampilkan QR Code di terminal untuk di-scan
        if (qr) {
            qrcode.generate(qr, { small: true });
            console.log("Silakan scan QR code di atas menggunakan WhatsApp!");
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(`⚠️ Koneksi terputus (status: ${statusCode}). ${shouldReconnect ? 'Mencoba reconnect...' : 'Logged out, tidak reconnect.'}`);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ Bot WhatsApp Berhasil Terhubung!');
        }
    });

    // Menerima pesan masuk
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (text) {
            console.log(`📩 Pesan masuk dari ${sender}: ${text}`);
            
            try {
                // Tanya ke Gemini AI
                const response = await ai.models.generateContent({
                    model: 'gemini-3.8-flash',
                    contents: text,
                    config: {
                        systemInstruction: 'Kamu adalah asisten AI yang ramah dan membantu. Selalu jawab dalam Bahasa Indonesia yang natural dan mudah dipahami. Jawab dengan ringkas tapi informatif.',
                    },
                });

                const replyText = response.text;
                if (!replyText) {
                    console.warn('⚠️ Gemini mengembalikan respons kosong.');
                    await sock.sendMessage(sender, { text: '⚠️ Maaf, saya tidak bisa memproses permintaan itu.' });
                    return;
                }

                // Balas ke pengirim
                await sock.sendMessage(sender, { text: replyText });
                console.log(`📤 Balasan terkirim ke ${sender}`);
            } catch (err) {
                console.error("❌ Gagal memproses pesan AI:", err.message || err);
                try {
                    await sock.sendMessage(sender, { text: '⚠️ Maaf, terjadi kesalahan saat memproses pesan kamu. Coba lagi nanti.' });
                } catch (sendErr) {
                    console.error("❌ Gagal mengirim pesan error:", sendErr.message || sendErr);
                }
            }
        }
    });
}

startBot();