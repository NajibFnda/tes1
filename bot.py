import os
from flask import Flask, request
from twilio.twiml.messaging_response import MessagingResponse
from google import genai
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Ambil API Key dari file .env
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY or GEMINI_API_KEY == "TEMPEL_API_KEY_GEMINI_DI_SINI":
    raise ValueError("❌ GEMINI_API_KEY belum diatur! Edit file .env terlebih dahulu.")

client = genai.Client(api_key=GEMINI_API_KEY)

@app.route("/bot", methods=["POST"])
def whatsapp_bot():
    try:
        # Mengambil pesan masuk dari pengguna
        incoming_msg = request.values.get("Body", "").strip()

        if not incoming_msg:
            twilio_resp = MessagingResponse()
            twilio_resp.message("⚠️ Pesan kosong diterima.")
            return str(twilio_resp)

        # Mengirim pertanyaan ke model Gemini
        response_ai = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=incoming_msg,
        )
        reply_text = response_ai.text

        if not reply_text:
            reply_text = "⚠️ Maaf, saya tidak bisa memproses permintaan itu."

        # Membalas kembali ke nomor WhatsApp lewat Twilio
        twilio_resp = MessagingResponse()
        twilio_resp.message(reply_text)
        return str(twilio_resp)

    except Exception as e:
        app.logger.error(f"❌ Error memproses pesan: {e}")
        twilio_resp = MessagingResponse()
        twilio_resp.message("⚠️ Maaf, terjadi kesalahan saat memproses pesan kamu. Coba lagi nanti.")
        return str(twilio_resp)

if __name__ == "__main__":
    app.run(port=5000)