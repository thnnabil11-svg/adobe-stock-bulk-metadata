import express from "express";
import multer from "multer";
import XLSX from "xlsx";
import Groq from "groq-sdk";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.static("public"));

const upload = multer({ dest: "uploads/" });

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

app.post("/generate", upload.array("images", 50), async (req, res) => {
  try {
    const results = [];

    for (const file of req.files) {

      // 🔥 READ IMAGE AS BASE64 (THIS IS THE KEY FIX)
      const imageBase64 = fs.readFileSync(file.path, { encoding: "base64" });

      const prompt = `
You are a professional Adobe Stock contributor.

Analyze the image and generate Adobe Stock optimized metadata.

RULES:
- Title: 5–12 words, descriptive, no symbols
- Description: 1 clear commercial sentence
- Keywords: EXACTLY 49 keywords, comma separated, singular, most important first

Return ONLY valid JSON:
{
  "title": "",
  "description": "",
  "keywords": ""
}
`;

      const response = await groq.chat.completions.create({
        model: "llama-3.2-11b-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ]
      });

      const metaText = response.choices[0].message.content;
      const meta = JSON.parse(metaText);

      results.push({
        Filename: file.originalname,
        Title: meta.title,
        Description: meta.description,
        Keywords: meta.keywords
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(results);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "AdobeStock");

    const outputFile = "adobe_stock_metadata.xlsx";
    XLSX.writeFile(workbook, outputFile);

    res.download(outputFile);

  } catch (err) {
    console.error(err); // 👈 IMPORTANT FOR DEBUG
    res.status(500).json({ error: "Metadata generation failed" });
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
