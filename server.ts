import express from "express";
import path from "path";
import sharp from "sharp";
import convert from "heic-convert";
import { createServer as createViteServer } from "vite";
import { convertPdfToWord, convertPdfToExcel, convertPdfToJpg } from "./server/pdfConverter";

const app = express();
const PORT = 3000;

// API routes - Image Conversion
app.post("/api/convert", express.raw({ type: '*/*', limit: '100mb' }), async (req, res) => {
  try {
    if (!req.body || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: "No file provided" });
    }

    const format = req.query.format as string || "JPG";
    const quality = parseFloat(req.query.quality as string) || 92;
    const stripSynthID = req.query.stripSynthID === "true";
    const isPng = format === "PNG";
    const isWebp = format === "WEBP";

    let outputBuffer: Buffer;
    
    try {
      // First try with Sharp
      let sharpInstance = sharp(req.body);

      // If stripSynthID is enabled, apply pixel frequency perturbation and micro-sharpening to disrupt SynthID signatures
      if (stripSynthID) {
        sharpInstance = sharpInstance
          .modulate({
            brightness: 1.001,
            saturation: 1.001
          })
          .sharpen({
            sigma: 0.5
          });
      }

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
      
      // Fallback to heic-convert
      const fallbackFormat = isPng ? "PNG" : "JPEG";
      const convertedBuffer = await convert({
        buffer: req.body,
        format: fallbackFormat,
        quality: quality / 100
      });
      
      // Apply sharp post-processing if webp or stripSynthID requested
      let postSharp = sharp(Buffer.from(convertedBuffer));
      if (stripSynthID) {
        postSharp = postSharp.modulate({ brightness: 1.001, saturation: 1.001 }).sharpen({ sigma: 0.5 });
      }
      if (isWebp) {
        outputBuffer = await postSharp.webp({ quality: Math.round(quality) }).toBuffer();
      } else if (stripSynthID) {
        outputBuffer = await postSharp.jpeg({ quality: Math.round(quality) }).toBuffer();
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
});

// API routes - PDF Conversion
app.post("/api/convert-pdf", express.raw({ type: '*/*', limit: '100mb' }), async (req, res) => {
  try {
    if (!req.body || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: "No file provided" });
    }

    const target = (req.query.target as string || "docx").toLowerCase();

    if (target === "jpg" || target === "jpeg") {
      const result = await convertPdfToJpg(req.body);
      if (result.isZip) {
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename="pages_jpg.zip"`);
      } else {
        res.setHeader("Content-Type", "image/jpeg");
        res.setHeader("Content-Disposition", `attachment; filename="page.jpg"`);
      }
      return res.send(result.buffer);
    }

    let outputBuffer: Buffer;
    let contentType: string;

    if (target === "xlsx" || target === "excel") {
      outputBuffer = await convertPdfToExcel(req.body);
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    } else {
      outputBuffer = await convertPdfToWord(req.body);
      contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }

    res.setHeader("Content-Type", contentType);
    res.send(outputBuffer);
  } catch (error: any) {
    console.error("PDF conversion error:", error);
    res.status(500).json({ error: error.message || "Failed to convert PDF file" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
