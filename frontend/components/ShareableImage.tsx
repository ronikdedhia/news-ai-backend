'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import { Share2, Download, X, Twitter, Facebook, Linkedin, Newspaper, Copy, FileText } from 'lucide-react';

interface ShareableImageProps {
  title: string;
  description: string;
  imageUrl: string;
  category: string;
}

export function ShareableImage({ title, description, imageUrl, category }: ShareableImageProps) {
  const shareRef      = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen]           = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied]           = useState(false);
  const [mounted, setMounted]         = useState(false);
  useEffect(() => { setMounted(true) }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const toTitleCase = (s: string) =>
    s.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const capture = async () => {
    if (!shareRef.current) return null;
    return html2canvas(shareRef.current, {
      backgroundColor: '#ffffff', scale: 2, useCORS: true,
      allowTaint: true, width: 400, windowWidth: 400, logging: false, imageTimeout: 0,
    });
  };

  const generateImage = async () => {
    setIsGenerating(true);
    try {
      const canvas = await capture();
      if (!canvas) return;
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `daily-bytes-${Date.now()}.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e) { console.error(e); } finally { setIsGenerating(false); }
  };

  const copyImage = async () => {
    setIsGenerating(true);
    try {
      const canvas = await capture();
      if (!canvas) return;
      canvas.toBlob(blob => {
        if (blob) navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      });
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch (e) { console.error(e); } finally { setIsGenerating(false); }
  };

  const downloadPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const canvas = await capture();
      if (!canvas) return;
      const doc = new jsPDF();
      const pw   = doc.internal.pageSize.getWidth();
      const iw   = pw - 20;
      const ih   = (canvas.height / canvas.width) * iw;
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 10, iw, ih);
      doc.save(`daily-bytes-${Date.now()}.pdf`);
    } catch (e) { console.error(e); }
  };

  return (
    <>
      {/* trigger — matches card's IconBtn style */}
      <button
        onClick={() => setIsOpen(true)}
        title="Share"
        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-all"
      >
        <Share2 className="w-3.5 h-3.5" />
      </button>

      {isOpen && mounted && createPortal(
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          onClick={e => { if (e.target === e.currentTarget) close(); }}
        >
          <div className="glass-strong rounded-3xl w-full max-w-md overflow-hidden shadow-2xl shadow-black/30 animate-in fade-in zoom-in-95 duration-200">

            {/* modal header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h2 className="text-lg font-bold">Share Article</h2>
              <button onClick={close} className="p-1.5 rounded-xl hover:bg-black/[0.05] dark:hover:bg-white/[0.07] text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* preview card (captured by html2canvas) */}
            <div className="px-6 pb-4">
              <div
                ref={shareRef}
                className="rounded-2xl overflow-hidden bg-white"
                style={{ width: '100%', maxWidth: 400 }}
              >
                {/* branding strip */}
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold leading-none">Daily Bytes</p>
                    <p className="text-[10px] text-indigo-200 mt-0.5">AI-curated news</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-white/20 rounded-full uppercase tracking-wide">
                    {toTitleCase(category)}
                  </span>
                </div>

                {/* image */}
                {imageUrl?.trim() ? (
                  <div style={{ width: '100%', height: 160, overflow: 'hidden', position: 'relative' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{ width: '100%', height: 100, background: 'linear-gradient(135deg,#6366f1,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Newspaper style={{ width: 40, height: 40, color: 'rgba(255,255,255,0.6)' }} />
                  </div>
                )}

                {/* content */}
                <div style={{ padding: '12px 16px 14px' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#111', lineHeight: 1.3, marginBottom: 6 }}>{title}</p>
                  <p style={{ fontSize: 11, color: '#555', lineHeight: 1.4, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {description || 'No description available'}
                  </p>
                  <div style={{ borderTop: '1px solid #eee', paddingTop: 8, textAlign: 'center' }}>
                    <p style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>Read more at</p>
                    <p style={{ fontSize: 11, color: '#6366f1', fontWeight: 700 }}>dailybytes.app</p>
                  </div>
                </div>
              </div>
            </div>

            {/* actions */}
            <div className="px-6 pb-4 flex gap-2">
              <button
                onClick={generateImage} disabled={isGenerating}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-md shadow-indigo-500/25"
              >
                <Download className="w-3.5 h-3.5" />
                {isGenerating ? 'Saving…' : 'Save Image'}
              </button>
              <button
                onClick={copyImage} disabled={isGenerating}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl glass border border-white/40 text-foreground text-xs font-semibold hover:bg-white/80 dark:hover:bg-white/10 transition-all"
              >
                <Copy className="w-3.5 h-3.5" />
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={downloadPDF}
                className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl glass border border-white/40 text-muted-foreground hover:text-foreground text-xs font-semibold transition-all"
                title="Download PDF"
              >
                <FileText className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* social links */}
            <div className="px-6 pb-5 pt-1 border-t border-black/[0.05] dark:border-white/[0.06]">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-3">Share on</p>
              <div className="flex gap-2">
                {[
                  { href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}`, label: 'X / Twitter', icon: <Twitter className="w-4 h-4" />, color: 'hover:bg-slate-100 dark:hover:bg-slate-800' },
                  { href: `https://www.facebook.com/sharer/sharer.php?u=https://dailybytes.app`, label: 'Facebook', icon: <Facebook className="w-4 h-4" />, color: 'hover:bg-blue-50 dark:hover:bg-blue-950/30' },
                  { href: `https://www.linkedin.com/shareArticle?mini=true&title=${encodeURIComponent(title)}`, label: 'LinkedIn', icon: <Linkedin className="w-4 h-4" />, color: 'hover:bg-blue-50 dark:hover:bg-blue-950/30' },
                  { href: `https://wa.me/?text=${encodeURIComponent(title)}`, label: 'WhatsApp', icon: (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  ), color: 'hover:bg-green-50 dark:hover:bg-green-950/30' },
                  { href: `https://t.me/share/url?url=https://dailybytes.app&text=${encodeURIComponent(title)}`, label: 'Telegram', icon: (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.54-.203 1.01.122.84.953z"/></svg>
                  ), color: 'hover:bg-sky-50 dark:hover:bg-sky-950/30' },
                ].map(({ href, label, icon, color }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer" title={label}
                    className={`flex-1 flex items-center justify-center p-2.5 rounded-xl glass transition-colors text-muted-foreground hover:text-foreground ${color}`}
                  >
                    {icon}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      , document.body)}
    </>
  );
}
