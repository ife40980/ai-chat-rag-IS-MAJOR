import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pg from "pg";

const pool = new pg.Pool({
  host: "localhost",
  port: 5432,
  database: "ai_chat_rag",
  user: "postgres",
  password: "Ife40980",
});

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const EMBEDDING_MODEL = "gemini-embedding-001";

//this turns the user, question into embedding, and then finds 
//the most similar chunks of cataglog stored in postgres.
async function findRelevantChunks(question) {
  const response = await fetch(
    `${GEMINI_BASE_URL}/models/${EMBEDDING_MODEL}:embedContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/Json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        content: { parts: [{ text: question }]},
        outputDimensionality: 768,

      })
    }
  );

  const data = await response.json();
  const questionEmbedding = data.embedding.values;
  const embeddingString = `[${questionEmbedding.join(",")}]`;

  const result = await pool.query(
    'SELECT content FROM catalog_chunks ORDER BY embedding <=> $1 LIMIT 3',
    [embeddingString]
  );

  return result.rows.map((row) => row.content);
}

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/chat", async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  if (!GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY environment variable");
    return res.status(500).json({ error: "Server is not configured with a Gemini API key." });
  }

const latestQuestion = messages[messages.length - 1].content;
const relevantChunks = await findRelevantChunks(latestQuestion);
const contextText = relevantChunks.join("\n\n");

  const contents = [
    {
      role: "user",
      parts: [
        {
          text: `you are a helpful assistant answering questions about UMBC's Information Systems B.S. program. Use the following catalog to answer accurately. if the answer isn't in the information provided, say you dont know. \n\nCatlog inforation: \n${contextText}`,
        },
      ],
    },
    {
      role: "model",
      parts: [{ text: "Understood, I'll answer based on that catalog inforation."}],
    },
    ...messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text:msg.content }],
    })),
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(
      `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({ contents }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);
      return res.status(response.status).json({ error: errText || "Upstream API error" });
    }

    const data = await response.json();
    const replyText =
      data.candidates?.[0]?.content?.parts?.map((part) => part.text).join("\n") ||
      data.candidates?.[0]?.content?.text ||
      "(no response from model)";

    res.json({ reply: replyText });
  } catch (error) {
    if (error.name === "AbortError") {
      console.error("Gemini API request timed out");
      return res.status(504).json({ error: "Upstream API request timed out" });
    }

    console.error("Unexpected backend error:", error);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    clearTimeout(timeout);
  }
});

const server = app.listen(PORT, () => {
  console.log(`AI chat backend running at http://localhost:${PORT}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the existing backend or set PORT to a different value in .env.`);
    process.exit(1);
  }
  console.error("Server error:", error);
  process.exit(1);
});
