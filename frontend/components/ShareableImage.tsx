'use client';

import { useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { Share2, Download, X, Twitter, Facebook, Linkedin, FileText, Newspaper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Image from 'next/image';

interface ShareableImageProps {
  title: string;
  description: string;
  imageUrl: string;
  category: string;
}

export function ShareableImage({ title, description, imageUrl, category }: ShareableImageProps) {
  const shareRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const toTitleCase = (str: string): string => {
    return str
      .toLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const imageToDataUrl = async (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          } else {
            reject(new Error('Could not get canvas context'));
          }
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = () => {
        // If CORS fails, return the original URL and let html2canvas try
        resolve(url);
      };
      img.src = url;
    });
  };

  const generateImage = async () => {
    if (!shareRef.current) return;

    setIsGenerating(true);
    try {
      const canvas = await html2canvas(shareRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        width: 400,
        windowWidth: 400,
        logging: false,
        imageTimeout: 0,
      });

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `daily-bytes-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error generating image:', error);
      alert('Failed to generate image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    if (!shareRef.current) return;

    setIsGenerating(true);
    try {
      const canvas = await html2canvas(shareRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        width: 400,
        windowWidth: 400,
        logging: false,
        imageTimeout: 0,
      });

      canvas.toBlob((blob) => {
        if (blob) {
          navigator.clipboard.write([
            new ClipboardItem({
              'image/png': blob,
            }),
          ]);
          alert('Image copied to clipboard!');
        }
      });
    } catch (error) {
      console.error('Error copying image:', error);
      alert('Failed to copy image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      
      // Use html2canvas to capture the entire preview with image
      const canvas = await html2canvas(shareRef.current!, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        imageTimeout: 0,
      });

      // Convert canvas to image data
      const imgData = canvas.toDataURL('image/png');
      
      // Create PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Calculate image dimensions to fit page
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height / canvas.width) * imgWidth;
      
      // Add image to PDF
      doc.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
      
      doc.save(`daily-bytes-${Date.now()}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        size="sm"
        className="flex items-center gap-1"
      >
        <Share2 className="w-4 h-4" />
        <span className="hidden sm:inline">Share</span>
      </Button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Share Article</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Shareable Image Preview */}
            <div
              ref={shareRef}
              className="bg-white rounded-lg overflow-hidden mb-4"
              style={{ width: '400px', minHeight: 'auto' }}
            >
              {/* Header with Branding */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-2 text-center">
                <h1 className="text-lg font-bold">Daily Bytes</h1>
                <p className="text-xs text-blue-100">Your Daily News Digest</p>
              </div>

              {/* Article Image */}
              <div className="relative w-full overflow-hidden" style={{ height: '160px' }}>
                {imageUrl && imageUrl.trim() ? (
                  <img
                    src={imageUrl}
                    alt={title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : null}
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: imageUrl && imageUrl.trim() ? 'transparent' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                  {!imageUrl || !imageUrl.trim() ? (
                    <div className="text-center text-white px-4">
                      <Newspaper className="w-16 h-16 mx-auto mb-2 opacity-80" />
                      <p className="text-sm font-semibold line-clamp-2">{title}</p>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Content */}
              <div className="p-2">
                {/* Title */}
                <h2 className="text-sm font-bold text-gray-900 mb-1" style={{ lineHeight: '1.2' }}>
                  {title}
                </h2>

                {/* Description */}
                <p className="text-xs text-gray-700 mb-2" style={{ lineHeight: '1.3' }}>
                  {description || 'No description available'}
                </p>

                {/* Category */}
                <div className="mb-2">
                  <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded-full">
                    {toTitleCase(category)}
                  </span>
                </div>

                {/* CTA */}
                <div className="border-t pt-1 text-center cursor-pointer hover:opacity-80 transition-opacity" onClick={() => window.open('https://www.dailybytes.com', '_blank')}>
                  <p className="text-xs text-gray-600 font-medium">
                    Read more on Daily Bytes
                  </p>
                  <p className="text-xs text-blue-600 font-bold">
                    www.dailybytes.com
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={generateImage}
                disabled={isGenerating}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                {isGenerating ? 'Generating...' : 'Image'}
              </Button>
              <Button
                onClick={copyToClipboard}
                disabled={isGenerating}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
              >
                Copy
              </Button>
              <Button
                onClick={downloadPDF}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Download
              </Button>
            </div>

            <p className="text-xs text-gray-500 text-center mt-3">
              Download or copy the image to share on social media
            </p>

            {/* Social Media Links */}
            <div className="flex justify-center gap-4 mt-3 pt-3 border-t flex-wrap">
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-600 hover:text-blue-400 hover:bg-blue-50 rounded-lg transition-all"
                title="Share on Twitter"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                title="Share on Facebook"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all"
                title="Share on LinkedIn"
              >
                <Linkedin className="w-5 h-5" />
              </a>
              <a
                href="https://wa.me/?text=Check%20out%20this%20article"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-600 hover:text-green-500 hover:bg-green-50 rounded-lg transition-all"
                title="Share on WhatsApp"
              >
                <img src="/whatsapp.svg" alt="WhatsApp" className="w-5 h-5" />
              </a>
              <a
                href="https://t.me/share/url?url=https://dailybytes.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-600 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                title="Share on Telegram"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.54-.203 1.01.122.84.953z"/>
                </svg>
              </a>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
