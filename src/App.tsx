/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  Upload, Settings, History, Download, Trash2, 
  CheckCircle2, ImageIcon, Layers, ShieldCheck, Check, 
  RefreshCw, ArrowRight, SlidersHorizontal, Maximize, 
  FileText, FileCode, Table as TableIcon, Sparkles, Fingerprint
} from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

type FileState = {
  id: string;
  file: File;
  status: 'pending' | 'converting' | 'success' | 'error';
  convertedBlob?: Blob;
  convertedUrl?: string;
  error?: string;
  targetFormatOverride?: string;
};

const t = {
  vi: {
    tabImage: "Chuyển đổi Hình ảnh",
    tabPdf: "Chuyển đổi PDF",
    hero1: "KÉO THẢ",
    hero2Image: "ẢNH VÀO ĐÂY",
    hero2Pdf: "FILE PDF VÀO ĐÂY",
    dragDropImage: "CHỌN HOẶC KÉO THẢ FILE ẢNH (HEIC, JPG, PNG, WEBP...)",
    dragDropPdf: "CHỌN HOẶC KÉO THẢ FILE PDF (SANG WORD / EXCEL)",
    dragDescImage: "Hỗ trợ upload hàng loạt • Tối đa 100MB mỗi ảnh",
    dragDescPdf: "Trích xuất văn bản & bảng biểu sang Word/Excel • Tối đa 100MB",
    hq: "CHẤT LƯỢNG CAO",
    fast: "XỬ LÝ NHANH",
    exif: "GIỮ NGUYÊN EXIF",
    smartExtraction: "TRÍCH XUẤT THÔNG MINH",
    batchMode: "Chế độ hàng loạt",
    settings: "Cài đặt",
    history: "Lịch sử",
    queue: "Hàng đợi chuyển đổi",
    convertRem: "Chuyển đổi file còn lại",
    convertNow: "Chuyển đổi ngay",
    processing: "Đang xử lý",
    ready: "Hoàn tất",
    retry: "Thử lại",
    dl: "Tải về",
    dlAll: "Tải xuống tất cả (ZIP)",
    activeQueue: "Hàng đợi",
    allSuccess: "Tất cả file đã chuyển đổi thành công",
    converting: "Đang chuyển đổi...",
    outFormat: "Định dạng đầu ra ảnh",
    pdfTargetFormat: "Định dạng chuyển đổi PDF",
    imgQuality: "Chất lượng ảnh",
    resizeOutput: "Kích thước tối đa",
    suffixOut: "Hậu tố file",
    poweredBy: "ĐƯỢC TẠO BỞI",
    errNoImage: "Vui lòng chọn file hình ảnh hợp lệ (HEIC, JPG, PNG, WEBP...).",
    errNoPdf: "Vui lòng chọn file định dạng PDF.",
    errMax: (len: number) => `Bạn đã chọn ${len} file. Hệ thống chỉ hỗ trợ tối đa 50 file cùng lúc.`,
    errServer: "Lỗi chuyển đổi file.",
    originalRes: "Giữ nguyên (100%)",
    uhd: "4K (Tối đa 3840px)",
    fhd: "Full HD (Tối đa 1920px)",
    hd: "HD (Tối đa 1280px)",
    wordDoc: "Word Document (.docx)",
    wordDesc: "Trích xuất đoạn văn, tiêu đề & cấu trúc trang thành file Word",
    excelSheet: "Excel Spreadsheet (.xlsx)",
    excelDesc: "Trích xuất bảng biểu, cột số liệu & dữ liệu thành file Excel",
    stripSynthIDTitle: "Xóa chữ ký AI & Watermark ẩn (Google SynthID)",
    stripSynthIDDesc: "Tự động loại bỏ metadata C2PA/EXIF và xáo trộn tần số pixel (chroma/DCT) để làm gián đoạn việc nhận dạng chữ ký AI (SynthID) mà vẫn giữ nguyên 100% chất lượng ảnh."
  },
  en: {
    tabImage: "Image Converter",
    tabPdf: "PDF Converter",
    hero1: "DROP YOUR",
    hero2Image: "IMAGES HERE",
    hero2Pdf: "PDF FILES HERE",
    dragDropImage: "SELECT OR DRAG IMAGE FILES (HEIC, JPG, PNG, WEBP...)",
    dragDropPdf: "SELECT OR DRAG PDF FILES (TO WORD / EXCEL)",
    dragDescImage: "Supports batch upload • Max file size: 100MB per image",
    dragDescPdf: "Extract text & tables into Word/Excel • Max 100MB",
    hq: "HIGH QUALITY",
    fast: "FAST PROCESSING",
    exif: "EXIF PRESERVED",
    smartExtraction: "SMART EXTRACTION",
    batchMode: "Batch Mode",
    settings: "Settings",
    history: "History",
    queue: "Conversion Queue",
    convertRem: "Convert Remaining",
    convertNow: "Convert Now",
    processing: "Processing",
    ready: "Ready",
    retry: "Retry",
    dl: "Download",
    dlAll: "Download All (ZIP)",
    activeQueue: "Active Queue",
    allSuccess: "All files converted successfully",
    converting: "Converting...",
    outFormat: "Image Output Format",
    pdfTargetFormat: "PDF Output Target",
    imgQuality: "Image Quality",
    resizeOutput: "Resize / Max Resolution",
    suffixOut: "Output Filename Suffix",
    poweredBy: "POWERED BY",
    errNoImage: "Please select valid image files (HEIC, JPG, PNG, WEBP...).",
    errNoPdf: "Please select valid PDF files.",
    errMax: (len: number) => `You selected ${len} files. Maximum 50 files allowed at once.`,
    errServer: "Server conversion error.",
    originalRes: "Original Resolution (100%)",
    uhd: "4K Ultra HD (Max 3840px)",
    fhd: "Full HD 1080p (Max 1920px)",
    hd: "Web HD (Max 1280px)",
    wordDoc: "Word Document (.docx)",
    wordDesc: "Convert PDF text, headers & structure into editable Word file",
    excelSheet: "Excel Spreadsheet (.xlsx)",
    excelDesc: "Extract PDF tables, grid numbers & data into Excel sheet",
    stripSynthIDTitle: "Strip AI Watermarks & Google SynthID",
    stripSynthIDDesc: "Strips C2PA/EXIF metadata and applies subtle pixel frequency perturbation to disrupt hidden AI watermark tracking (Google SynthID) while keeping full visual image quality."
  }
};

export default function App() {
  const [lang, setLang] = useState<'vi' | 'en'>('vi');
  const txt = t[lang];

  const [activeTab, setActiveTab] = useState<'image' | 'pdf'>('image');
  const [pdfTarget, setPdfTarget] = useState<'docx' | 'xlsx'>('docx');

  const [files, setFiles] = useState<FileState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  const [settings, setSettings] = useState({
    format: 'JPG',
    quality: 92,
    resolution: 'original',
    suffix: '_converted',
    stripSynthID: true
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processFiles = (newFiles: File[]) => {
    let validFiles: File[] = [];

    if (activeTab === 'image') {
      validFiles = newFiles.filter((f) => {
        const ext = f.name.toLowerCase().split('.').pop() || '';
        return (
          f.type.startsWith('image/') ||
          ['heic', 'heif', 'jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'bmp', 'tiff'].includes(ext)
        );
      });

      if (validFiles.length === 0) {
        alert(txt.errNoImage);
        return;
      }
    } else {
      validFiles = newFiles.filter((f) => {
        const ext = f.name.toLowerCase().split('.').pop() || '';
        return f.type === 'application/pdf' || ext === 'pdf';
      });

      if (validFiles.length === 0) {
        alert(txt.errNoPdf);
        return;
      }
    }

    const newFileStates: FileState[] = validFiles.map((f) => ({
      id: Math.random().toString(36).substring(7),
      file: f,
      status: 'pending',
      targetFormatOverride: activeTab === 'pdf' ? pdfTarget : undefined
    }));

    setFiles((prev) => {
      const combined = [...prev, ...newFileStates];
      if (combined.length > 50) {
        alert(txt.errMax(combined.length));
        return combined.slice(0, 50);
      }
      return combined;
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const convertFile = async (id: string, currentFile?: FileState) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: 'converting', error: undefined } : f))
    );

    const fileState = currentFile || files.find((f) => f.id === id);
    if (!fileState) return;

    const isPdf = activeTab === 'pdf' || fileState.file.name.toLowerCase().endsWith('.pdf');
    const endpoint = isPdf 
      ? `/api/convert-pdf?target=${fileState.targetFormatOverride || pdfTarget}`
      : `/api/convert?format=${settings.format}&quality=${settings.quality}&stripSynthID=${settings.stripSynthID}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream'
        },
        body: fileState.file
      });

      if (!response.ok) {
        let errStr = txt.errServer;
        try {
          const text = await response.text();
          try {
            const errRes = JSON.parse(text);
            errStr = errRes.error || errStr;
          } catch {
            errStr = text || errStr;
          }
        } catch (e) {
          console.error("Failed to read error response", e);
        }
        throw new Error(errStr);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? { ...f, status: 'success', convertedBlob: blob, convertedUrl: url }
            : f
        )
      );
    } catch (error: any) {
      console.error("conversion error for file", fileState.file.name, ":", error);
      let errMsg = "Lỗi: " + (error instanceof Error ? error.message : typeof error === 'object' ? JSON.stringify(error) : String(error));

      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? { ...f, status: 'error', error: errMsg }
            : f
        )
      );
    }
  };

  const convertAll = async () => {
    const filesToConvert = files.filter(f => f.status === 'pending' || f.status === 'error');
    for (const f of filesToConvert) {
      await convertFile(f.id, f);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.convertedUrl) {
        URL.revokeObjectURL(file.convertedUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const getOutputFilename = (fileState: FileState) => {
    const originalName = fileState.file.name;
    const isPdf = activeTab === 'pdf' || originalName.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      const baseName = originalName.replace(/\.pdf$/i, '');
      const ext = fileState.targetFormatOverride || pdfTarget;
      return `${baseName}${settings.suffix}.${ext}`;
    } else {
      const baseName = originalName.replace(/\.[^/.]+$/, '');
      const ext = settings.format.toLowerCase();
      return `${baseName}${settings.suffix}.${ext}`;
    }
  };

  const downloadFile = (file: FileState) => {
    if (file.status === 'success' && file.convertedUrl) {
      const a = document.createElement('a');
      a.href = file.convertedUrl;
      a.download = getOutputFilename(file);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const downloadAllZip = async () => {
    const successFiles = files.filter(f => f.status === 'success' && f.convertedBlob);
    if (successFiles.length === 0) return;

    if (successFiles.length === 1) {
      downloadFile(successFiles[0]);
      return;
    }

    const zip = new JSZip();
    successFiles.forEach((f) => {
      zip.file(getOutputFilename(f), f.convertedBlob!);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `converted_${activeTab === 'pdf' ? 'pdf_documents' : 'images'}.zip`);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  const allSuccess = files.length > 0 && files.every(f => f.status === 'success');
  const progressPercent = files.length === 0 ? 0 : Math.round((files.filter(f => f.status === 'success').length / files.length) * 100);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-[#38bdf8]/30">
      
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 border-b border-white/5 bg-[#050505]/80 backdrop-blur-md sticky top-0 z-50 h-16">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-xl font-black tracking-tighter text-[#38bdf8] uppercase">HUYDAT</span>
            <span className="text-xs font-bold tracking-widest text-white/50 uppercase">Converter</span>
          </div>
          <div className="text-[10px] font-black tracking-widest text-[#050505] bg-[#38bdf8] px-2 py-1 rounded shadow-[0_0_15px_rgba(56,189,248,0.3)] uppercase">
            Free
          </div>
        </div>

        <div className="hidden md:flex items-center gap-8 h-full">
          <button 
            onClick={() => setShowSettings(false)}
            className={`flex items-center gap-2 text-sm font-bold tracking-wide transition-all h-full py-4 border-b-2 ${!showSettings ? 'text-[#38bdf8] border-[#38bdf8]' : 'text-white/60 border-transparent hover:text-white'}`}
          >
            <Layers className="w-4 h-4" />
            {txt.batchMode} {files.length > 0 && !showSettings && <span className="bg-[#38bdf8] text-black text-[10px] px-1.5 py-0.5 rounded-full">{files.length}</span>}
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            className={`flex items-center gap-2 text-sm font-bold tracking-wide transition-all h-full py-4 border-b-2 ${showSettings ? 'text-[#38bdf8] border-[#38bdf8]' : 'text-white/60 border-transparent hover:text-white'}`}
          >
            <Settings className="w-4 h-4" />
            {txt.settings}
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center bg-white/5 border border-white/10 rounded-full p-0.5">
            <button 
              onClick={() => setLang('en')}
              className={`text-[10px] font-bold px-2 py-1 rounded-full transition-colors ${lang === 'en' ? 'bg-[#38bdf8] text-black' : 'text-white/50 hover:text-white'}`}
            >EN</button>
            <button 
              onClick={() => setLang('vi')}
              className={`text-[10px] font-bold px-2 py-1 rounded-full transition-colors ${lang === 'vi' ? 'bg-[#38bdf8] text-black' : 'text-white/50 hover:text-white'}`}
            >VI</button>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white/50 border border-white/10 px-3 py-1.5 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" />
            100% KHÔNG CÓ QC
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-16 flex flex-col items-center">
        
        {/* Background Typography */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none flex items-center justify-center opacity-[0.03]">
          <div className="text-[20vw] font-black tracking-tighter leading-none flex gap-8">
            <span>{activeTab === 'pdf' ? 'PDF' : 'IMAGE'}</span>
            <span>{activeTab === 'pdf' ? 'WORD' : 'WEBP'}</span>
          </div>
        </div>

        {/* TAB SWITCHER */}
        {!showSettings && (
          <div className="relative z-10 flex items-center justify-center gap-2 bg-[#111] border border-white/10 p-1.5 rounded-2xl mb-8 shadow-xl">
            <button
              onClick={() => {
                setActiveTab('image');
                setFiles([]);
              }}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                activeTab === 'image'
                  ? 'bg-[#38bdf8] text-black shadow-[0_0_20px_rgba(56,189,248,0.3)]'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              {txt.tabImage}
            </button>
            <button
              onClick={() => {
                setActiveTab('pdf');
                setFiles([]);
              }}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                activeTab === 'pdf'
                  ? 'bg-[#38bdf8] text-black shadow-[0_0_20px_rgba(56,189,248,0.3)]'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <FileText className="w-4 h-4" />
              {txt.tabPdf}
            </button>
          </div>
        )}

        {showSettings ? (
          <div className="relative z-10 w-full max-w-4xl mx-auto bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 md:p-12 mb-32 shadow-2xl">
            <div className="flex items-start gap-4 mb-12 border-b border-white/5 pb-8">
              <div className="text-[#38bdf8]">
                <SlidersHorizontal className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-wide text-white uppercase">Conversion Settings</h2>
                <p className="text-sm text-white/50 mt-1">Customize formats, quality, and output naming settings</p>
              </div>
            </div>

            <div className="space-y-12">
              {/* Image Format */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold tracking-widest text-white uppercase flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[#38bdf8]" /> {txt.outFormat}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { id: 'JPG', title: 'JPG / JPEG', desc: 'Best overall compatibility for web, Windows, Android, printing' },
                    { id: 'PNG', title: 'PNG', desc: 'Lossless quality, larger file size, supports transparency' },
                    { id: 'WEBP', title: 'WEBP', desc: 'Modern web image format, maximum compression ratio' }
                  ].map(fmt => (
                    <button
                      key={fmt.id}
                      onClick={() => setSettings(s => ({ ...s, format: fmt.id }))}
                      className={`p-5 rounded-xl border text-left transition-all ${
                        settings.format === fmt.id 
                          ? 'border-[#38bdf8] bg-[#38bdf8]/5' 
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-white tracking-wide">{fmt.title}</span>
                        {settings.format === fmt.id && <CheckCircle2 className="w-5 h-5 text-[#38bdf8]" />}
                      </div>
                      <p className="text-xs text-white/50 leading-relaxed">{fmt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality */}
              <div className="space-y-6 pt-8 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold tracking-widest text-white uppercase flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-[#38bdf8]" /> {txt.imgQuality}
                  </h3>
                  <span className="text-xl font-black text-[#38bdf8]">{settings.quality}%</span>
                </div>
                
                <input 
                  type="range" 
                  min="1" 
                  max="100" 
                  value={settings.quality}
                  onChange={(e) => setSettings(s => ({ ...s, quality: parseInt(e.target.value) }))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#38bdf8]"
                />

                <div className="flex flex-wrap gap-3">
                  {[
                    { label: 'WEB (60%)', value: 60 },
                    { label: 'BALANCED (80%)', value: 80 },
                    { label: 'HIGH QUALITY (92%)', value: 92 },
                    { label: 'MAX (100%)', value: 100 }
                  ].map(preset => (
                    <button
                      key={preset.value}
                      onClick={() => setSettings(s => ({ ...s, quality: preset.value }))}
                      className={`px-4 py-2 rounded-full text-xs font-bold tracking-widest transition-all ${
                        settings.quality === preset.value
                          ? 'bg-[#38bdf8] text-black'
                          : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Watermark / SynthID Disruption */}
              <div className="space-y-4 pt-8 border-t border-white/5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-amber-500/10 via-white/5 to-transparent border border-amber-500/20">
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex items-center gap-2.5">
                      <Fingerprint className="w-5 h-5 text-amber-400" />
                      <h3 className="text-sm font-bold tracking-wide text-white uppercase">
                        {txt.stripSynthIDTitle}
                      </h3>
                      <span className="text-[10px] font-extrabold tracking-widest text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-0.5 rounded-full uppercase">
                        AI Shield
                      </span>
                    </div>
                    <p className="text-xs text-white/60 leading-relaxed">
                      {txt.stripSynthIDDesc}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSettings(s => ({ ...s, stripSynthID: !s.stripSynthID }))}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      settings.stripSynthID ? 'bg-[#38bdf8]' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
                        settings.stripSynthID ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Suffix */}
              <div className="space-y-4 pt-8 border-t border-white/5">
                <h3 className="text-xs font-bold tracking-widest text-white uppercase flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#38bdf8]" /> {txt.suffixOut}
                </h3>
                <div className="flex items-center gap-3 text-sm font-medium text-white/50">
                  <span>document</span>
                  <input
                    type="text"
                    value={settings.suffix}
                    onChange={(e) => setSettings(s => ({ ...s, suffix: e.target.value }))}
                    className="bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-[#38bdf8] transition-colors w-48 font-mono text-sm"
                    placeholder="_converted"
                  />
                  <span className="text-[#38bdf8]">{activeTab === 'pdf' ? `.${pdfTarget}` : `.${settings.format.toLowerCase()}`}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Hero Header */}
            <div className="relative z-10 text-center mb-8 select-none">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter uppercase text-white">
                {txt.hero1} <span className="text-[#38bdf8]">{activeTab === 'pdf' ? txt.hero2Pdf : txt.hero2Image}</span>
              </h1>
            </div>

            {/* Target Selector for PDF inside PDF Tab */}
            {activeTab === 'pdf' && (
              <div className="relative z-10 flex items-center gap-4 mb-6">
                <span className="text-xs font-bold tracking-wider text-white/50 uppercase">Tùy chọn đầu ra:</span>
                <div className="flex bg-[#111] border border-white/10 p-1 rounded-xl">
                  <button
                    onClick={() => setPdfTarget('docx')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
                      pdfTarget === 'docx' ? 'bg-[#38bdf8] text-black' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5" /> Word (.docx)
                  </button>
                  <button
                    onClick={() => setPdfTarget('xlsx')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
                      pdfTarget === 'xlsx' ? 'bg-[#38bdf8] text-black' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    <TableIcon className="w-3.5 h-3.5" /> Excel (.xlsx)
                  </button>
                </div>
              </div>
            )}

            {/* Dropzone */}
            <div className="relative z-10 w-full max-w-2xl mb-8">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative border border-white/10 rounded-2xl p-10 md:p-14 
                  text-center cursor-pointer transition-all duration-300
                  ${isDragging ? 'bg-white/5 border-[#38bdf8]/50 scale-[1.02]' : 'bg-[#0a0a0a] hover:bg-[#111] hover:border-white/20'}
                `}
                style={{ backgroundImage: 'radial-gradient(circle at center, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept={activeTab === 'pdf' ? 'application/pdf,.pdf' : 'image/*,.heic,.heif'}
                  multiple
                  onChange={handleFileInput}
                />
                
                <div className="flex flex-col items-center justify-center space-y-8 pointer-events-none">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors duration-300 ${isDragging ? 'bg-[#38bdf8] text-black shadow-[0_0_30px_rgba(56,189,248,0.4)]' : 'bg-[#38bdf8] text-black shadow-[0_0_20px_rgba(56,189,248,0.2)]'}`}>
                    <Upload className="w-8 h-8" strokeWidth={2.5} />
                  </div>
                  
                  <div className="space-y-3">
                    <p className="text-lg md:text-xl font-bold tracking-wide text-white">
                      {activeTab === 'pdf' ? txt.dragDropPdf : txt.dragDropImage}
                    </p>
                    <p className="text-xs font-medium tracking-wide text-white/40 uppercase">
                      {activeTab === 'pdf' ? txt.dragDescPdf : txt.dragDescDescImage}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] font-bold tracking-widest text-white/40 uppercase">
                    {activeTab === 'image' ? (
                      <>
                        <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-[#38bdf8]" /> {txt.hq} {settings.format}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-[#38bdf8]" /> {txt.fast}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-[#38bdf8]" /> {txt.exif}</span>
                      </>
                    ) : (
                      <>
                        <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-[#38bdf8]" /> WORD &amp; EXCEL OUTPUT</span>
                        <span>•</span>
                        <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-[#38bdf8]" /> {txt.fast}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-[#38bdf8]" /> {txt.smartExtraction}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 text-center flex items-center justify-center gap-2 text-xs font-medium text-white/40 uppercase tracking-widest">
                {txt.poweredBy} 
                <a href="https://inhuydat.com" target="_blank" rel="noopener noreferrer" className="text-[#38bdf8] font-bold hover:underline transition-colors">
                  HUYDAT
                </a>
              </div>
            </div>

            {/* Queue Section */}
            {files.length > 0 && (
              <div className="relative z-10 w-full max-w-4xl space-y-3 mt-8 pb-32">
                <div className="flex items-center justify-between mb-6 px-2">
                  <h2 className="text-sm font-bold tracking-widest text-white/40 uppercase">{txt.queue}</h2>
                  {files.some(f => f.status === 'pending' || f.status === 'error') && (
                    <button 
                      onClick={convertAll}
                      className="text-xs font-black tracking-widest bg-[#38bdf8] text-[#050505] px-6 py-3 rounded-full hover:bg-white hover:text-black uppercase flex items-center gap-2 transition-all cursor-pointer shadow-[0_0_20px_rgba(56,189,248,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)]"
                    >
                      <RefreshCw className="w-4 h-4" /> {txt.convertRem}
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {files.map((file) => {
                    const ratio = file.convertedBlob && file.file.size > 0 
                      ? Math.round((1 - file.convertedBlob.size / file.file.size) * 100) 
                      : null;

                    const isPdfFile = activeTab === 'pdf' || file.file.name.toLowerCase().endsWith('.pdf');
                    const targetFormatLabel = isPdfFile 
                      ? (file.targetFormatOverride || pdfTarget).toUpperCase()
                      : settings.format;

                    return (
                      <div 
                        key={file.id}
                        className="flex items-center justify-between p-4 rounded-xl bg-[#0a0a0a] border border-white/10 hover:border-white/20 transition-all gap-4"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 relative overflow-hidden">
                            {isPdfFile ? (
                              <FileText className="w-6 h-6 text-[#38bdf8]" />
                            ) : (
                              <ImageIcon className="w-6 h-6 text-white/40" />
                            )}
                            {file.status === 'converting' && (
                              <div className="absolute inset-0 bg-[#111]/80 backdrop-blur-sm flex items-center justify-center">
                                <RefreshCw className="w-4 h-4 animate-spin text-[#38bdf8]" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-md">
                                {file.file.name}
                              </p>
                              {ratio !== null && ratio > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#38bdf8]/20 text-[#38bdf8]">
                                  -{ratio}%
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs font-semibold text-white/40 mt-1">
                              <span>{formatSize(file.file.size)}</span>
                              {file.convertedBlob && (
                                <>
                                  <ArrowRight className="w-3 h-3" />
                                  <span className="text-[#38bdf8]">{formatSize(file.convertedBlob.size)}</span>
                                </>
                              )}
                            </div>
                            {file.error && (
                              <p className="text-xs text-red-400 mt-1 font-medium">{file.error}</p>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3 shrink-0">
                          {file.status === 'pending' && (
                            <button
                              onClick={() => convertFile(file.id)}
                              className="text-xs font-bold px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer uppercase"
                            >
                              {txt.convertNow}
                            </button>
                          )}

                          {file.status === 'converting' && (
                            <span className="text-xs font-bold text-white/40 tracking-widest uppercase flex items-center gap-2 px-2">
                              <RefreshCw className="w-3 h-3 animate-spin" /> {txt.processing}
                            </span>
                          )}
                          
                          {file.status === 'success' && (
                            <>
                              <div className="flex items-center gap-1.5 text-[#38bdf8] mr-2">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="text-xs font-bold tracking-widest uppercase">{txt.ready.toUpperCase()} ({targetFormatLabel})</span>
                              </div>
                              <button
                                onClick={() => downloadFile(file)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#38bdf8] text-black hover:bg-[#7dd3fc] font-bold text-xs tracking-widest transition-colors cursor-pointer uppercase"
                              >
                                <Download className="w-4 h-4" /> {txt.dl}
                              </button>
                            </>
                          )}

                          {file.status === 'error' && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => convertFile(file.id)}
                                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                              >
                                {txt.retry.toUpperCase()}
                              </button>
                            </div>
                          )}

                          <button
                            onClick={() => removeFile(file.id)}
                            className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-red-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

      </main>

      {/* Persistent Bottom Download Bar */}
      {files.length > 0 && !showSettings && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-t border-white/10 p-4">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Queue Status */}
            <div className="flex flex-col gap-2 w-full md:w-auto">
              <div className="text-[10px] font-bold tracking-widest text-white/40 uppercase">
                {txt.activeQueue} ({files.length})
              </div>
              <div className="flex items-center gap-2">
                {files.slice(0, 4).map(f => (
                  <div key={f.id} className="w-8 h-8 rounded bg-white/10 border border-white/10 flex items-center justify-center relative">
                    {f.file.type.includes('pdf') || f.file.name.endsWith('.pdf') ? (
                      <FileText className="w-4 h-4 text-[#38bdf8]" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-white/20" />
                    )}
                    {f.status === 'success' && (
                      <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#38bdf8]" />
                    )}
                  </div>
                ))}
                {files.length > 4 && (
                  <span className="text-xs font-bold text-white/40">+{files.length - 4}</span>
                )}
              </div>
            </div>

            {/* Overall Progress */}
            <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
              <div className="flex flex-col items-end">
                <div className="text-2xl font-black tracking-tighter text-white">
                  {progressPercent}<span className="text-2xl text-white/40 mb-1">%</span>
                </div>
                {allSuccess && (
                  <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-[#38bdf8] uppercase">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {txt.allSuccess}
                  </div>
                )}
                {!allSuccess && files.some(f => f.status === 'converting') && (
                  <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-white/50 uppercase">
                    <RefreshCw className="w-3 h-3 animate-spin" /> {txt.converting}
                  </div>
                )}
              </div>

              {/* Download All Button */}
              <button
                onClick={downloadAllZip}
                disabled={!files.some(f => f.status === 'success')}
                className={`
                  flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-bold tracking-widest uppercase transition-all w-full md:w-auto
                  ${files.some(f => f.status === 'success')
                    ? 'bg-[#38bdf8] text-black hover:bg-[#7dd3fc] shadow-[0_0_30px_rgba(56,189,248,0.3)] hover:shadow-[0_0_40px_rgba(56,189,248,0.4)] cursor-pointer'
                    : 'bg-white/5 text-white/30 cursor-not-allowed border border-white/10'
                  }
                `}
              >
                <Download className="w-5 h-5" />
                {txt.dlAll}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
