import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-2.5-flash-image";

const PROMPT = `You are analyzing a photo taken by someone trying to "capture" cats they encounter in real life, like a collectible sighting.

Look at the attached photo. If it does NOT contain a real cat, respond with exactly the text "NO_CAT_FOUND" and nothing else.

If it DOES contain a real cat, generate the following: A 2D digital illustration of the specific cat provided in the input image, maintaining its core features, color, and pose. Style: 90s retro anime aesthetic, lo-fi background art style, clean dark linework, cel-shaded, hard-edged shadows, muted earthy color palette, desaturated warm tones, golden ambient lighting, cozy slice-of-life atmosphere, matte finish, flat colors, no gradients, nostalgic vintage anime visual language. Return only the generated image.`;

/**
 * @param {Buffer} photoBuffer
 * @param {string} mimeType
 * @returns {Promise<{ catFound: false } | { catFound: true, imageBuffer: Buffer, imageMimeType: string }>}
 */
export async function analyzeAndStylize(photoBuffer, mimeType) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: PROMPT },
          { inlineData: { mimeType, data: photoBuffer.toString("base64") } },
        ],
      },
    ],
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((part) => part.inlineData);

  if (!imagePart) {
    return { catFound: false };
  }

  return {
    catFound: true,
    imageBuffer: Buffer.from(imagePart.inlineData.data, "base64"),
    imageMimeType: imagePart.inlineData.mimeType ?? "image/png",
  };
}
