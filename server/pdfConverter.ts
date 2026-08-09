import { createRequire } from 'node:module';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import ExcelJS from 'exceljs';
import { GoogleGenAI } from '@google/genai';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

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
