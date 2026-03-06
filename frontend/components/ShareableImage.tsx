'use client';

import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Share2, Download, X } from 'lucide-react';
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

  const generateImage = async () => {
    if (!shareRef.current) return;

    setIsGenerating(true);
    try {
      const canvas = await html2canvas(shareRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `daily-bytes-${Date.now()}.png`;
      link.click();
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
              className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden mb-4"
              style={{ width: '100%', maxWidth: '400px' }}
            >
              {/* Header with Branding */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 text-center">
                <h1 className="text-2xl font-bold">Daily Bytes</h1>
                <p className="text-xs text-blue-100">Your Daily News Digest</p>
              </div>

              {/* Article Image */}
              <div className="relative w-full h-48 bg-gray-200 overflow-hidden">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={title}
                    fill
                    className="object-cover"
                    priority
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-300">
                    <span className="text-gray-500">No Image</span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                {/* Title */}
                <h2 className="text-lg font-bold text-gray-900 mb-3 line-clamp-3">
                  {title}
                </h2>

                {/* Description */}
                <p className="text-sm text-gray-700 mb-4 line-clamp-3">
                  {description || 'No description available'}
                </p>

                {/* Category */}
                <div className="mb-4">
                  <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full">
                    {toTitleCase(category)}
                  </span>
                </div>

                {/* CTA */}
                <div className="border-t pt-3 text-center">
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
                {isGenerating ? 'Generating...' : 'Download'}
              </Button>
              <Button
                onClick={copyToClipboard}
                disabled={isGenerating}
                variant="outline"
                className="flex-1"
              >
                Copy
              </Button>
            </div>

            <p className="text-xs text-gray-500 text-center mt-3">
              Download or copy the image to share on social media
            </p>
          </Card>
        </div>
      )}
    </>
  );
}
