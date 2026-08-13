import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import ExcelJS from 'exceljs';
import { GoogleGenAI } from '@google/genai';
import JSZip from 'jszip';
import * as canvasModule from '@napi-rs/canvas';

if (typeof globalThis !== 'undefined') {
  (globalThis as any).Path2D = canvasModule.Path2D;
  (globalThis as any).ImageData = canvasModule.ImageData;
  (globalThis as any).DOMMatrix = canvasModule.DOMMatrix;
}

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

function tryGetPath2D(arg: any): any {
  if (arg instanceof canvasModule.Path2D) return arg;
  if (typeof arg === 'string') {
    if (arg === 'nonzero' || arg === 'evenodd') return null;
    try { return new canvasModule.Path2D(arg); } catch (_) {}
  }
  if (arg && typeof arg === 'object') {
    const str = arg.d || arg._d || arg.pathData || (typeof arg.toString === 'function' ? arg.toString() : null);
    if (typeof str === 'string' && str.length > 0 && str !== '[object Object]') {
      try { return new canvasModule.Path2D(str); } catch (_) {}
    }
  }
  return null;
}

function makeCanvasContextRobust(ctx: any) {
  const origClip = ctx.clip;
  ctx.clip = function (...args: any[]) {
    try {
      if (args.length === 0) return origClip.call(this);
      const pathObj = tryGetPath2D(args[0]);
      const rule = typeof args[0] === 'string' ? args[0] : (typeof args[1] === 'string' ? args[1] : undefined);
      if (pathObj) {
        return rule ? origClip.call(this, pathObj, rule) : origClip.call(this, pathObj);
      }
      if (rule) {
        return origClip.call(this, rule);
      }
      return origClip.call(this);
    } catch (_) {
      try { return origClip.call(this); } catch (e) {}
    }
  };

  const origFill = ctx.fill;
  ctx.fill = function (...args: any[]) {
    try {
      if (args.length === 0) return origFill.call(this);
      const pathObj = tryGetPath2D(args[0]);
      const rule = typeof args[0] === 'string' ? args[0] : (typeof args[1] === 'string' ? args[1] : undefined);
      if (pathObj) {
        return rule ? origFill.call(this, pathObj, rule) : origFill.call(this, pathObj);
      }
      if (rule) {
        return origFill.call(this, rule);
      }
      return origFill.call(this);
    } catch (_) {
      try { return origFill.call(this); } catch (e) {}
    }
  };

  const origStroke = ctx.stroke;
  ctx.stroke = function (...args: any[]) {
    try {
      if (args.length === 0) return origStroke.call(this);
      const pathObj = tryGetPath2D(args[0]);
      if (pathObj) return origStroke.call(this, pathObj);
      return origStroke.call(this);
    } catch (_) {
      try { return origStroke.call(this); } catch (e) {}
    }
  };

  const origSetTransform = ctx.setTransform;
  ctx.setTransform = function (...args: any[]) {
    try {
      if (args.length === 6) {
        return origSetTransform.apply(this, args.map((a: any) => Number(a) || 0));
      }
      if (args.length === 1 && args[0] && typeof args[0] === 'object') {
        const { a = 1, b = 0, c = 0, d = 1, e = 0, f = 0 } = args[0];
        return origSetTransform.call(this, a, b, c, d, e, f);
      }
      return origSetTransform.call(this, 1, 0, 0, 1, 0, 0);
    } catch (_) {
      try { return origSetTransform.call(this, 1, 0, 0, 1, 0, 0); } catch (e) {}
    }
  };

  const origTransform = ctx.transform;
  ctx.transform = function (...args: any[]) {
    try {
      if (args.length >= 6) {
        return origTransform.apply(this, args.slice(0, 6).map((a: any) => Number(a) || 0));
      }
    } catch (_) {}
  };

  const origDrawImage = ctx.drawImage;
  ctx.drawImage = function (...args: any[]) {
    try {
      if (!args[0]) return;
      return origDrawImage.apply(this, args);
    } catch (_) {}
  };

  const origCreatePattern = ctx.createPattern;
  ctx.createPattern = function (...args: any[]) {
    try {
      if (!args[0]) return null;
      return origCreatePattern.apply(this, args);
    } catch (_) {
      return null;
    }
  };

  const origIsPointInPath = ctx.isPointInPath;
  ctx.isPointInPath = function (...args: any[]) {
    try {
      return origIsPointInPath.apply(this, args);
    } catch (_) {
      return false;
    }
  };

  const origIsPointInStroke = ctx.isPointInStroke;
  ctx.isPointInStroke = function (...args: any[]) {
    try {
      return origIsPointInStroke.apply(this, args);
    } catch (_) {
      return false;
    }
  };
}

export async function convertPdfToJpg(pdfBuffer: Buffer): Promise<{ buffer: Buffer; isZip: boolean; count: number }> {
  const workerModule = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  (globalThis as any).pdfjsWorker = workerModule;

  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const pdfjsPkgPath = require.resolve('pdfjs-dist/package.json');
  const pdfjsDir = path.dirname(pdfjsPkgPath);
  const cMapUrl = pathToFileURL(path.join(pdfjsDir, 'cmaps') + '/').href;
  const standardFontDataUrl = pathToFileURL(path.join(pdfjsDir, 'standard_fonts') + '/').href;

  const data = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjsLib.getDocument({
    data,
    cMapUrl,
    cMapPacked: true,
    standardFontDataUrl,
  });

  const pdfDocument = await loadingTask.promise;
  const numPages = pdfDocument.numPages;
  const jpgBuffers: { name: string; buffer: Buffer }[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDocument.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 });
    
    const canvas = canvasModule.createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
    const context = canvas.getContext('2d');
    makeCanvasContextRobust(context);

    await page.render({
      canvasContext: context as any,
      canvas: canvas as any,
      viewport: viewport,
    } as any).promise;

    const jpegBuffer = canvas.toBuffer('image/jpeg');
    jpgBuffers.push({
      name: `page_${pageNum}.jpg`,
      buffer: jpegBuffer,
    });
  }

  if (jpgBuffers.length === 1) {
    return { buffer: jpgBuffers[0].buffer, isZip: false, count: 1 };
  }

  const zip = new JSZip();
  jpgBuffers.forEach((item) => {
    zip.file(item.name, item.buffer);
  });

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  return { buffer: zipBuffer, isZip: true, count: jpgBuffers.length };
}

async function extractStructuredContentWithGemini(pdfBuffer: Buffer) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const base64Pdf = pdfBuffer.toString('base64');

    const prompt = `Bạn là một chuyên gia trích xuất dữ liệu từ PDF.
Hãy phân tích tài liệu PDF này và trả về JSON có cấu trúc như sau:
{
  "title": "Tiêu đề chính của tài liệu (nếu có)",
  "sections": [
    {
      "heading": "Tên mục / Tiêu đề phụ",
      "paragraphs": ["Đoạn văn 1", "Đoạn văn 2"],
      "table": [
        ["Cột 1", "Cột 2", "Cột 3"],
        ["Dữ liệu 1", "Dữ liệu 2", "Dữ liệu 3"]
      ]
    }
  ]
}
Lưu ý: Chỉ trả về JSON hợp lệ, không bọc markdown hay chú thích thừa.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'application/pdf', data: base64Pdf } },
            { text: prompt }
          ]
        }
      ]
    });

    const text = response.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.warn("Gemini PDF parsing failed, falling back to pdf-parse:", err);
  }
  return null;
}

export async function convertPdfToWord(pdfBuffer: Buffer): Promise<Buffer> {
  const geminiData = await extractStructuredContentWithGemini(pdfBuffer);

  if (geminiData && geminiData.sections) {
    const docChildren: any[] = [];

    if (geminiData.title) {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: geminiData.title,
              bold: true,
              size: 32,
              color: '000000',
            }),
          ],
          spacing: { after: 300 },
        })
      );
    }

    for (const sec of geminiData.sections) {
      if (sec.heading) {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: sec.heading,
                bold: true,
                size: 24,
                color: '0284C7',
              }),
            ],
            spacing: { before: 200, after: 100 },
          })
        );
      }

      if (Array.isArray(sec.paragraphs)) {
        for (const pText of sec.paragraphs) {
          docChildren.push(
            new Paragraph({
              children: [new TextRun({ text: pText, size: 22 })],
              spacing: { after: 120 },
            })
          );
        }
      }

      if (Array.isArray(sec.table) && sec.table.length > 0) {
        const tableRows = sec.table.map((rowArr: string[], rowIndex: number) => {
          return new TableRow({
            children: rowArr.map((cellText: string) => {
              return new TableCell({
                width: { size: 100 / Math.max(rowArr.length, 1), type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: cellText || '',
                        bold: rowIndex === 0,
                        size: 20,
                      }),
                    ],
                  }),
                ],
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                  left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                  right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                },
              });
            }),
          });
        });

        docChildren.push(
          new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
        docChildren.push(new Paragraph({ spacing: { after: 200 } }));
      }
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: docChildren,
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }

  // Fallback to pdf-parse text extraction
  const pdfData = await pdfParse(pdfBuffer);
  const text = pdfData.text || '';
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const paragraphs = lines.map((line) => {
    const isHeading = line.length < 50 && (line === line.toUpperCase() || line.endsWith(':'));
    return new Paragraph({
      children: [
        new TextRun({
          text: line,
          bold: isHeading,
          size: isHeading ? 26 : 22,
          color: isHeading ? '0284C7' : '000000',
        }),
      ],
      spacing: { after: isHeading ? 180 : 120 },
    });
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs.length > 0 ? paragraphs : [new Paragraph({ children: [new TextRun('Chưa tìm thấy văn bản trong PDF.')] })],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

export async function convertPdfToExcel(pdfBuffer: Buffer): Promise<Buffer> {
  const geminiData = await extractStructuredContentWithGemini(pdfBuffer);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Data');

  if (geminiData && geminiData.sections) {
    let currentRow = 1;

    if (geminiData.title) {
      worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
      const titleCell = worksheet.getCell(`A${currentRow}`);
      titleCell.value = geminiData.title;
      titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF0284C7' } };
      currentRow += 2;
    }

    for (const sec of geminiData.sections) {
      if (sec.heading) {
        worksheet.getCell(`A${currentRow}`).value = sec.heading;
        worksheet.getCell(`A${currentRow}`).font = { name: 'Segoe UI', size: 13, bold: true };
        currentRow += 1;
      }

      if (Array.isArray(sec.table) && sec.table.length > 0) {
        sec.table.forEach((rowArr: string[], rIndex: number) => {
          const row = worksheet.getRow(currentRow);
          rowArr.forEach((val, cIndex) => {
            const cell = row.getCell(cIndex + 1);
            cell.value = isNaN(Number(val)) || val.trim() === '' ? val : Number(val);
            cell.font = { name: 'Segoe UI', size: 11, bold: rIndex === 0 };

            if (rIndex === 0) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF38BDF8' },
              };
              cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
            }

            cell.border = {
              top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
              left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
              bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
              right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
            };
          });
          currentRow++;
        });
        currentRow++;
      } else if (Array.isArray(sec.paragraphs)) {
        sec.paragraphs.forEach((pText: string) => {
          worksheet.getCell(`A${currentRow}`).value = pText;
          currentRow++;
        });
        currentRow++;
      }
    }
  } else {
    // Fallback: parse lines into spreadsheet rows
    const pdfData = await pdfParse(pdfBuffer);
    const text = pdfData.text || '';
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    lines.forEach((line) => {
      // Split by tab, multiple spaces, or comma
      const parts = line.split(/\t|\s{2,}|;/);
      worksheet.addRow(parts);
    });

    // Style header row if exists
    if (worksheet.rowCount > 0) {
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF38BDF8' },
        };
      });
    }
  }

  // Auto-fit columns
  worksheet.columns.forEach((column) => {
    let maxLen = 12;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > maxLen) maxLen = Math.min(len, 60);
    });
    column.width = maxLen + 3;
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
