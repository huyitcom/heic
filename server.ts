import express from "express";
import path from "path";
import multer from "multer";
import convert from "heic-convert";
import { createServer as createViteServer } from "vite";

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/convert", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      console.log("Received file:", req.file.originalname, "size:", req.file.size);

      // Support PNG/JPEG based on request body, fallback to JPEG
      const reqFormat = req.body.format;
      const format = reqFormat === 'PNG' ? 'PNG' : 'JPEG';
      const quality = parseFloat(req.body.quality) || 0.92;

      // Convert HEIC
      const outBuffer = await convert({
        buffer: req.file.buffer, // the HEIC file buffer
        format: format,          // output format
        quality: quality         // the jpeg compression quality, between 0 and 1
      });

      console.log("Converted file, new size:", outBuffer.length);

      res.set("Content-Type", format === 'PNG' ? "image/png" : "image/jpeg");
      res.send(Buffer.from(outBuffer));
    } catch (error: any) {
      console.error("Conversion error:", error);
      res.status(500).json({ error: error.message || "Failed to convert file" });
    }
  });

  // Vite middleware for development
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
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
