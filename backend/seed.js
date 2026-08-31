import fs from "fs";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const EMBEDDING_MODEL = "gemini-embedding-001";

const pool = new pg.Pool({
    host: "localhost",
    port: 5432,
    database: "ai_chat_rag",
    user: "postgres",
    password: process.env.DB_PASSWORD,
});

function chunkText(text) {
    return text
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);
}

//this sends one cunk of text to gemini and gets back it's embedding
//(a list of 768 numbers representing what that text "means").
async function getEmbedding(text) {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": GEMINI_API_KEY,
            },
            body:JSON.stringify({
                content: { parts: [{ text }] },
                outputDimensionality:768,
            }),
            
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            throw new Error (`Embedding request failed: ${errText}`);
        }

        const data = await response.json();
        return data.embedding.values;
}

async function main() {
    const rawText = fs. readFileSync("./catalog.txt", "utf-8");
    const chunks = chunkText(rawText);


    console.log(`split catalogue into ${chunks.length} chunks. Embedding each one...`);

    //this clears out old data , and makes it so that re-running the script wont create dups
    await pool.query("DELETE FROM catalog_chunks");

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`Embedding chunk ${i+1}/${chunks.length}...`);

        const embedding = await getEmbedding(chunk);


        //ppvector expects the embedding to be formatted like a string
        const embeddingString = `[${embedding.join(",")}]`;

        await pool.query(
            "INSERT INTO catalog_chunks (content, embedding) VALUES ($1, $2)",
            [chunk, embeddingString]
        );
    }

    console.log("Done! ALL chunks embedding and stored.");
    await pool.end();
}

main().catch((err) => {
    console.error("Seed script failed:", err);
    process.exit(1);
});