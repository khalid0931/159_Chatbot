const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.redirect('/index.html');
});

function normalizeMessages(messages) {
  return messages.map((msg) => {
    const role = msg.role === 'assistant' ? 'model' : 'user';
    const text = typeof msg.content === 'string'
      ? msg.content
      : JSON.stringify(msg.content ?? '');

    return {
      role,
      parts: [{ text }]
    };
  });
}

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'Messages harus berupa array dan tidak boleh kosong'
      });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY belum diatur di file .env'
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: normalizeMessages(messages)
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini API error:', data);
      return res.status(response.status).json({
        error: data?.error?.message || 'Gagal memanggil Gemini API'
      });
    }

    const reply = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .join('') || '';

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    res.write(`data: ${JSON.stringify(reply)}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Server Error:', error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Terjadi kesalahan pada server'
      });
    }

    res.write(
      `data: ${JSON.stringify({
        error: 'Terjadi kesalahan pada server'
      })}\n\n`
    );
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
