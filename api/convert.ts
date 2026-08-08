import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';
import convert from 'heic-convert';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: '10mb',
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const format = req.query.format as string || "JPG";
    const quality = parseFloat(req.query.quality as string) || 92;

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.length === 0) {
      return res.status(400).json({ error: "No file provided" });
    }

    const isPng = format === "PNG";
    const isWebp = format === "WEBP";
    let outputBuffer: Buffer;
    
    try {
      let sharpInstance = sharp(buffer);

      if (isPng) {
        sharpInstance = sharpInstance.png({ quality: Math.round(quality) });
      } else if (isWebp) {
        sharpInstance = sharpInstance.webp({ quality: Math.round(quality) });
      } else {
        sharpInstance = sharpInstance.jpeg({ quality: Math.round(quality) });
      }

      outputBuffer = await sharpInstance.toBuffer();
    } catch (sharpError) {
      console.warn("Sharp conversion failed, falling back to heic-convert:", sharpError);
      
      const fallbackFormat = isPng ? "PNG" : "JPEG";
      const convertedBuffer = await convert({
        buffer: buffer,
        format: fallbackFormat,
        quality: quality / 100
      });
      
      if (isWebp) {
        outputBuffer = await sharp(Buffer.from(convertedBuffer)).webp({ quality: Math.round(quality) }).toBuffer();
      } else {
        outputBuffer = Buffer.from(convertedBuffer);
      }
    }

    const mimeType = isPng ? "image/png" : isWebp ? "image/webp" : "image/jpeg";
    res.setHeader("Content-Type", mimeType);
    res.send(outputBuffer);
  } catch (error: any) {
    console.error("Conversion error:", error);
    res.status(500).json({ error: error.message || "Failed to convert file" });
  }
}
