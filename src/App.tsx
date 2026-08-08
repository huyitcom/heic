/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo } from 'react';
import { 
  Upload, Settings, History, Eye, Download, Trash2, 
  CheckCircle2, ImageIcon, Layers, ShieldCheck, Check, 
  Sparkles, RefreshCw, AlertCircle, ArrowRight,
  SlidersHorizontal, Maximize, FileText, Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

type FileState = {
  id: string;
  file: File;
  status: 'pending' | 'converting' | 'success' | 'error';
  convertedBlob?: Blob;
  convertedUrl?: string;
  error?: string;
};

const t = {
  vi: {
    hero1: "KÉO THẢ",
    hero2: "ẢNH VÀO ĐÂY",
    dragDrop: "CHỌN HOẶC KÉO THẢ FILE HEIC",
    dragDesc: "Hỗ trợ upload hàng loạt • Tối đa 100MB mỗi ảnh",
    hq: "CHẤT LƯỢNG CAO",
    fast: "XỬ LÝ NHANH",
    exif: "GIỮ NGUYÊN EXIF",
    batchMode: "Chế độ hàng loạt",
    settings: "Cài đặt",
    history: "Lịch sử",
    queue: "Hàng đợi",
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
    outFormat: "Định dạng đầu ra",
    imgQuality: "Chất lượng ảnh",
    resizeOutput: "Kích thước tối đa",
    suffixOut: "Hậu tố file",
    poweredBy: "ĐƯỢC TẠO BỞI",
    errNoHeic: "Vui lòng chọn file định dạng HEIC.",
    errMax: (len: number) => `Bạn đã chọn ${len} file. Hệ thống chỉ hỗ trợ tối đa 50 file cùng lúc.`,
    errServer: "Lỗi chuyển đổi file.",
    originalRes: "Giữ nguyên (100%)",
    uhd: "4K (Tối đa 3840px)",
    fhd: "Full HD (Tối đa 1920px)",
    hd: "HD (Tối đa 1280px)"
  },
  en: {
    hero1: "DROP YOUR",
    hero2: "IMAGES HERE",
    dragDrop: "SELECT OR DRAG HEIC FILES",
    dragDesc: "Supports batch upload • Max file size: 100MB per image",
    hq: "HIGH QUALITY",
    fast: "FAST PROCESSING",
    exif: "EXIF PRESERVED",
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
    outFormat: "Output Format",
    imgQuality: "Image Quality",
    resizeOutput: "Resize / Max Resolution",
    suffixOut: "Output Filename Suffix",
    poweredBy: "POWERED BY",
    errNoHeic: "Please select HEIC format files.",
    errMax: (len: number) => `You selected ${len} files. Maximum 50 files allowed at once.`,
    errServer: "Server conversion error.",
    originalRes: "Original Resolution (100%)",
    uhd: "4K Ultra HD (Max 3840px)",
    fhd: "Full HD 1080p (Max 1920px)",
    hd: "Web HD (Max 1280px)"
  }
};

export default function App() {
  const [lang, setLang] = useState<'vi' | 'en'>('vi');
  const txt = t[lang];

  const [files, setFiles] = useState<FileState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  const [settings, setSettings] = useState({
    format: 'JPG',
    quality: 92,
    resolution: 'original',
    suffix: '_converted'
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
    const heicFiles = newFiles.filter(
      (f) => f.type === 'image/heic' || f.name.toLowerCase().endsWith('.heic')
    );

    if (heicFiles.length === 0) {
      alert(txt.errNoHeic);
      return;
    }

    const newFileStates: FileState[] = heicFiles.map((f) => ({
      id: Math.random().toString(36).substring(7),
      file: f,
      status: 'pending',
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

    try {
      const response = await fetch(`/api/convert?format=${settings.format}&quality=${settings.quality}`, {
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
        } catch(e) {
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

  const getOutputFilename = (originalName: string) => {
    const baseName = originalName.replace(/\.heic$/i, '');
    const ext = settings.format.toLowerCase();
    return `${baseName}${settings.suffix}.${ext}`;
  };

  const downloadFile = (file: FileState) => {
    if (file.status === 'success' && file.convertedUrl) {
      const a = document.createElement('a');
      a.href = file.convertedUrl;
      a.download = getOutputFilename(file.file.name);
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
      zip.file(getOutputFilename(f.file.name), f.convertedBlob!);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'converted_images.zip');
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  const allSuccess = files.length > 0 && files.every(f => f.status === 'success');
  const progressPercent = files.length === 0 ? 0 : Math.round((files.filter(f => f.status === 'success').length / files.length) * 100);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-[#00ff41]/30">
      
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 border-b border-white/5 bg-[#050505]/80 backdrop-blur-md sticky top-0 z-50 h-16">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-xl font-black tracking-tighter text-white uppercase">Huy Dat</span>
            <span className="text-xl font-black tracking-tighter text-[#00ff41] uppercase">Converter</span>
          </div>
          <div className="hidden sm:block text-[10px] font-bold tracking-widest text-white/50 border border-white/10 px-2 py-1 rounded bg-white/5">
            HEIC &rarr; JPG
          </div>
          <div className="text-[10px] font-black tracking-widest text-[#050505] bg-[#00ff41] px-2 py-1 rounded shadow-[0_0_15px_rgba(0,255,65,0.3)] uppercase">
            Free
          </div>
        </div>

        <div className="hidden md:flex items-center gap-8 h-full">
          <button 
            onClick={() => setShowSettings(false)}
            className={`flex items-center gap-2 text-sm font-bold tracking-wide transition-all h-full py-4 border-b-2 ${!showSettings ? 'text-[#00ff41] border-[#00ff41]' : 'text-white/60 border-transparent hover:text-white'}`}
          >
            <Layers className="w-4 h-4" />
            {txt.batchMode} {files.length > 0 && !showSettings && <span className="bg-[#00ff41] text-black text-[10px] px-1.5 py-0.5 rounded-full">{files.length}</span>}
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            className={`flex items-center gap-2 text-sm font-bold tracking-wide transition-all h-full py-4 border-b-2 ${showSettings ? 'text-[#00ff41] border-[#00ff41]' : 'text-white/60 border-transparent hover:text-white'}`}
          >
            <Settings className="w-4 h-4" />
            {txt.settings}
          </button>
          <button className="flex items-center gap-2 text-white/60 text-sm font-bold tracking-wide transition-all h-full py-4 border-b-2 border-transparent hover:text-white cursor-not-allowed opacity-50">
            <History className="w-4 h-4" />
            {txt.history}
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center bg-white/5 border border-white/10 rounded-full p-0.5">
            <button 
              onClick={() => setLang('en')}
              className={`text-[10px] font-bold px-2 py-1 rounded-full transition-colors ${lang === 'en' ? 'bg-[#00ff41] text-black' : 'text-white/50 hover:text-white'}`}
            >EN</button>
            <button 
              onClick={() => setLang('vi')}
              className={`text-[10px] font-bold px-2 py-1 rounded-full transition-colors ${lang === 'vi' ? 'bg-[#00ff41] text-black' : 'text-white/50 hover:text-white'}`}
            >VI</button>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white/50 border border-white/10 px-3 py-1.5 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" />
            100% IN-BROWSER PRIVACY
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-24 flex flex-col items-center">
        
        {/* Background Typography */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none flex items-center justify-center opacity-[0.03]">
          <div className="text-[20vw] font-black tracking-tighter leading-none flex gap-8">
            <span>HEIC</span>
            <span>JPG</span>
          </div>
        </div>

        {showSettings ? (
          <div className="relative z-10 w-full max-w-4xl mx-auto bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 md:p-12 mb-32 shadow-2xl">
            <div className="flex items-start gap-4 mb-12 border-b border-white/5 pb-8">
              <div className="text-[#00ff41]">
                <SlidersHorizontal className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-wide text-white uppercase">Conversion Settings</h2>
                <p className="text-sm text-white/50 mt-1">Customize output formats, compression quality, and filename configurations</p>
              </div>
            </div>

            <div className="space-y-12">
              {/* Format */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold tracking-widest text-white uppercase flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[#00ff41]" /> {txt.outFormat}
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
                          ? 'border-[#00ff41] bg-[#00ff41]/5' 
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-white tracking-wide">{fmt.title}</span>
                        {settings.format === fmt.id && <CheckCircle2 className="w-5 h-5 text-[#00ff41]" />}
                      </div>
                      <p className="text-xs text-white/50 leading-relaxed">{fmt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold tracking-widest text-white uppercase flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-[#00ff41]" /> {txt.imgQuality}
                  </h3>
                  <span className="text-xl font-black text-[#00ff41]">{settings.quality}%</span>
                </div>
                
                <input 
                  type="range" 
                  min="1" 
                  max="100" 
                  value={settings.quality}
                  onChange={(e) => setSettings(s => ({ ...s, quality: parseInt(e.target.value) }))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#00ff41]"
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
                          ? 'bg-[#00ff41] text-black'
                          : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolution */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold tracking-widest text-white uppercase flex items-center gap-2">
                  <Maximize className="w-4 h-4 text-[#00ff41]" /> {txt.resizeOutput}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { id: 'original', label: txt.originalRes },
                    { id: '4k', label: txt.uhd },
                    { id: '1080p', label: txt.fhd },
                    { id: '720p', label: txt.hd }
                  ].map(res => (
                    <button
                      key={res.id}
                      onClick={() => setSettings(s => ({ ...s, resolution: res.id }))}
                      className={`p-4 rounded-xl border text-left transition-all flex items-center ${
                        settings.resolution === res.id 
                          ? 'border-[#00ff41] bg-[#00ff41]/5 text-white' 
                          : 'border-white/10 bg-white/5 hover:border-white/20 text-white/60'
                      }`}
                    >
                      <span className="text-sm font-semibold leading-snug">{res.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Suffix */}
              <div className="space-y-4 pt-8 border-t border-white/5">
                <h3 className="text-xs font-bold tracking-widest text-white uppercase flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#00ff41]" /> {txt.suffixOut}
                </h3>
                <div className="flex items-center gap-3 text-sm font-medium text-white/50">
                  <span>photo</span>
                  <input
                    type="text"
                    value={settings.suffix}
                    onChange={(e) => setSettings(s => ({ ...s, suffix: e.target.value }))}
                    className="bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-[#00ff41] transition-colors w-48 font-mono text-sm"
                    placeholder="_converted"
                  />
                  <span className="text-[#00ff41]">.{settings.format.toLowerCase()}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Hero Header */}
            <div className="relative z-10 text-center mb-8 select-none">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter uppercase text-white">
                {txt.hero1} <span className="text-[#00ff41]">{txt.hero2}</span>
              </h1>
            </div>

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
                  ${isDragging ? 'bg-white/5 border-[#00ff41]/50 scale-[1.02]' : 'bg-[#0a0a0a] hover:bg-[#111] hover:border-white/20'}
                `}
                style={{ backgroundImage: 'radial-gradient(circle at center, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".heic,image/heic"
                  multiple
                  onChange={handleFileInput}
                />
                
                <div className="flex flex-col items-center justify-center space-y-8 pointer-events-none">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors duration-300 ${isDragging ? 'bg-[#00ff41] text-black shadow-[0_0_30px_rgba(0,255,65,0.4)]' : 'bg-[#00ff41] text-black shadow-[0_0_20px_rgba(0,255,65,0.2)]'}`}>
                    <Upload className="w-8 h-8" strokeWidth={2.5} />
                  </div>
                  
                  <div className="space-y-3">
                    <p className="text-lg md:text-xl font-bold tracking-wide text-white">
                      {txt.dragDrop}
                    </p>
                    <p className="text-xs font-medium tracking-wide text-white/40 uppercase">
                      {txt.dragDesc}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] font-bold tracking-widest text-white/40 uppercase">
                    <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-[#00ff41]" /> {txt.hq} {settings.format}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-[#00ff41]" /> {txt.fast}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-[#00ff41]" /> {txt.exif}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 text-center flex items-center justify-center gap-2 text-xs font-medium text-white/40 uppercase tracking-widest">
                {txt.poweredBy} 
                <a href="https://inhuydat.com" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#00ff41] transition-colors">
                  INHUYDAT
                </a>
              </div>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="relative z-10 w-full max-w-4xl space-y-3 mt-12 pb-32">
                <div className="flex items-center justify-between mb-6 px-2">
                  <h2 className="text-sm font-bold tracking-widest text-white/40 uppercase">{txt.queue}</h2>
                  {files.some(f => f.status === 'pending' || f.status === 'error') && (
                    <button 
                      onClick={convertAll}
                      className="text-xs font-black tracking-widest bg-[#00ff41] text-[#050505] px-6 py-3 rounded-full hover:bg-white hover:text-black uppercase flex items-center gap-2 transition-all cursor-pointer shadow-[0_0_20px_rgba(0,255,65,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)]"
                    >
                      <RefreshCw className="w-4 h-4" /> {txt.convertRem}
                    </button>
                  )}
                </div>

                <AnimatePresence>
                  {files.map((file) => {
                    const ratio = file.convertedBlob 
                      ? Math.round((1 - file.convertedBlob.size / file.file.size) * 100) 
                      : null;

                    return (
                      <motion.div 
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={file.id} 
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-[#111] border border-white/5 rounded-xl hover:bg-[#161616] hover:border-white/10 transition-all group"
                      >
                        {/* Left Info */}
                        <div className="flex items-center gap-4 w-full sm:w-auto overflow-hidden">
                          <div className="w-12 h-12 bg-[#1a232c] border border-blue-900/30 rounded-lg flex items-center justify-center text-blue-400 shrink-0 overflow-hidden relative">
                             {file.convertedUrl ? (
                              <img src={file.convertedUrl} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-5 h-5" />
                            )}
                            {file.status === 'converting' && (
                              <div className="absolute inset-0 bg-[#111]/80 backdrop-blur-sm flex items-center justify-center">
                                <RefreshCw className="w-4 h-4 animate-spin text-[#00ff41]" />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-semibold text-white truncate max-w-[200px] sm:max-w-[300px]" title={file.file.name}>
                                {file.file.name}
                              </p>
                              {ratio !== null && ratio > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#00ff41]/20 text-[#00ff41]">
                                  -{ratio}%
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs font-medium text-white/40">
                              <span>{formatSize(file.file.size)}</span>
                              {file.convertedBlob && (
                                <>
                                  <ArrowRight className="w-3 h-3" />
                                  <span className="text-[#00ff41]">{formatSize(file.convertedBlob.size)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right Actions */}
                        <div className="flex items-center justify-end gap-3 w-full sm:w-auto border-t border-white/5 sm:border-t-0 pt-3 sm:pt-0">
                          
                          {file.status === 'pending' && (
                             <button
                              onClick={() => convertFile(file.id)}
                              className="text-xs font-bold px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                            >
                              {txt.convertNow.toUpperCase()}
                            </button>
                          )}

                          {file.status === 'converting' && (
                            <span className="text-xs font-bold text-white/40 tracking-widest uppercase flex items-center gap-2 px-2">
                              <RefreshCw className="w-3 h-3 animate-spin" /> {txt.processing}
                            </span>
                          )}
                          
                          {file.status === 'success' && (
                            <>
                              <div className="flex items-center gap-1.5 text-[#00ff41] mr-2">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="text-xs font-bold tracking-widest uppercase">{txt.ready.toUpperCase()} ({settings.format})</span>
                              </div>
                              {file.convertedUrl && (
                                <a
                                  href={file.convertedUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-2 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                                  title="Preview"
                                >
                                  <Eye className="w-4 h-4" />
                                </a>
                              )}
                              <button
                                onClick={() => downloadFile(file)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00ff41] text-black hover:bg-[#00e63a] font-bold text-xs tracking-widest transition-colors cursor-pointer uppercase"
                              >
                                <Download className="w-4 h-4" /> {txt.dl}
                              </button>
                            </>
                          )}

                          {file.status === 'error' && (
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold text-red-500 max-w-[150px] truncate" title={file.error}>{file.error}</span>
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
                            className="p-2 rounded-lg border border-white/5 text-white/30 hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/10 transition-colors cursor-pointer ml-1"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </main>

      {/* Sticky Bottom Bar (when files exist and not in settings) */}
      <AnimatePresence>
        {files.length > 0 && !showSettings && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-[#050505]/95 backdrop-blur-xl z-50 p-4 md:p-6"
          >
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
              
              {/* Queue Status */}
              <div className="flex flex-col gap-2 w-full md:w-auto">
                <div className="text-[10px] font-bold tracking-widest text-white/40 uppercase">
                  {txt.activeQueue} ({files.length})
                </div>
                <div className="flex items-center gap-2">
                  {files.slice(0, 4).map(f => (
                    <div key={f.id} className="w-10 h-10 rounded bg-[#1a232c] border border-white/5 flex items-center justify-center overflow-hidden relative">
                      {f.convertedUrl ? (
                        <img src={f.convertedUrl} alt="" className="w-full h-full object-cover opacity-80" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-white/20" />
                      )}
                      {f.status === 'success' && (
                        <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#00ff41]" />
                      )}
                    </div>
                  ))}
                  {files.length > 4 && (
                    <div className="w-10 h-10 rounded bg-white/5 border border-white/5 flex items-center justify-center text-xs font-bold text-white/60">
                      +{files.length - 4}
                    </div>
                  )}
                </div>
              </div>

              {/* Center Status */}
              <div className="flex flex-col items-center gap-1 text-center">
                <div className="text-4xl md:text-5xl font-black tracking-tighter text-white flex items-end leading-none">
                  {progressPercent}<span className="text-2xl text-white/40 mb-1">%</span>
                </div>
                {allSuccess && (
                  <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-[#00ff41] uppercase">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {txt.allSuccess}
                  </div>
                )}
                {!allSuccess && files.some(f => f.status === 'converting') && (
                  <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-white/50 uppercase animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" /> {txt.converting}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="w-full md:w-auto flex justify-end">
                <button
                  onClick={downloadAllZip}
                  disabled={files.filter(f => f.status === 'success').length === 0}
                  className={`
                    flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-bold tracking-widest uppercase transition-all w-full md:w-auto
                    ${files.some(f => f.status === 'success')
                      ? 'bg-[#00ff41] text-black hover:bg-[#00e63a] shadow-[0_0_30px_rgba(0,255,65,0.3)] hover:shadow-[0_0_40px_rgba(0,255,65,0.4)] cursor-pointer'
                      : 'bg-white/5 text-white/30 cursor-not-allowed border border-white/10'
                    }
                  `}
                >
                  <Download className="w-5 h-5" />
                  {txt.dlAll}
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
