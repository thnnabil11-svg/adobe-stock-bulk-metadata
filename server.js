import express from "express";
import multer from "multer";
import XLSX from "xlsx";
import Groq from "groq-sdk";
import cors from "cors";

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
      const imageUrl = `https://${req.get("host")}/uploads/${file.filename}`;

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
              { type: "image_url", image_url: { url: imageUrl } }
            ]
          }
        ]
      });

      const meta = JSON.parse(response.choices[0].message.content);

      results.push({
        Filename: file.originalname,   // ✅ ADOBE STOCK MATCH
        Title: meta.title,
        Description: meta.description,
        Keywords: meta.keywords
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(results);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "AdobeStock");

    const fileName = "adobe_stock_metadata.xlsx";
    XLSX.writeFile(workbook, fileName);

    res.download(fileName);

  } catch (err) {
    res.status(500).json({ error: "Metadata generation failed" });
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});

