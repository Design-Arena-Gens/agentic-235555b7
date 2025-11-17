'use client';

import { useState, useRef, useCallback } from 'react';
import imageCompression from 'browser-image-compression';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { jsPDF } from 'jspdf';

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Compression & Resize settings
  const [quality, setQuality] = useState(80);
  const [maxWidth, setMaxWidth] = useState(1920);
  const [maxHeight, setMaxHeight] = useState(1080);
  const [outputFormat, setOutputFormat] = useState<'jpeg' | 'png' | 'webp' | 'pdf'>('jpeg');

  // Cropping
  const [showCrop, setShowCrop] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  // File stats
  const [originalSize, setOriginalSize] = useState<number>(0);
  const [compressedSize, setCompressedSize] = useState<number>(0);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setOriginalSize(file.size);

    // Handle HEIC conversion
    if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
      try {
        const heic2any = (await import('heic2any')).default;
        const convertedBlob = await heic2any({
          blob: file,
          toType: 'image/jpeg',
        });
        const convertedFile = new File(
          [convertedBlob as Blob],
          file.name.replace(/\.heic$/i, '.jpg'),
          { type: 'image/jpeg' }
        );
        const reader = new FileReader();
        reader.onload = (e) => setOriginalImage(e.target?.result as string);
        reader.readAsDataURL(convertedFile);
        setSelectedFile(convertedFile);
      } catch (error) {
        console.error('HEIC conversion error:', error);
        alert('Error converting HEIC file');
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => setOriginalImage(e.target?.result as string);
      reader.readAsDataURL(file);
    }

    setProcessedImage(null);
    setCompletedCrop(undefined);
    setShowCrop(false);
  };

  const processImage = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);

    try {
      let fileToProcess = selectedFile;

      // Apply crop if exists
      if (completedCrop && imgRef.current) {
        const croppedBlob = await getCroppedImage(imgRef.current, completedCrop);
        fileToProcess = new File([croppedBlob], selectedFile.name, { type: selectedFile.type });
      }

      // Compress and resize
      const options = {
        maxSizeMB: 10,
        maxWidthOrHeight: Math.max(maxWidth, maxHeight),
        useWebWorker: true,
        quality: quality / 100,
        fileType: `image/${outputFormat === 'jpeg' ? 'jpeg' : outputFormat}`,
      };

      const compressedFile = await imageCompression(fileToProcess, options);

      // Convert to PDF if needed
      if (outputFormat === 'pdf') {
        const pdfBlob = await convertToPDF(compressedFile);
        setCompressedSize(pdfBlob.size);
        const url = URL.createObjectURL(pdfBlob);
        setProcessedImage(url);
      } else {
        setCompressedSize(compressedFile.size);
        const reader = new FileReader();
        reader.onload = (e) => setProcessedImage(e.target?.result as string);
        reader.readAsDataURL(compressedFile);
      }
    } catch (error) {
      console.error('Processing error:', error);
      alert('Error processing image');
    }

    setIsProcessing(false);
  };

  const getCroppedImage = (image: HTMLImageElement, crop: PixelCrop): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('No 2d context');

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        resolve(blob);
      }, 'image/jpeg');
    });
  };

  const convertToPDF = async (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const pdf = new jsPDF({
            orientation: img.width > img.height ? 'landscape' : 'portrait',
            unit: 'px',
            format: [img.width, img.height]
          });
          pdf.addImage(e.target?.result as string, 'JPEG', 0, 0, img.width, img.height);
          const pdfBlob = pdf.output('blob');
          resolve(pdfBlob);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const downloadImage = () => {
    if (!processedImage) return;

    const link = document.createElement('a');
    link.href = processedImage;
    link.download = `compressed-${Date.now()}.${outputFormat}`;
    link.click();
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const compressionRatio = originalSize > 0 && compressedSize > 0
    ? Math.round((1 - compressedSize / originalSize) * 100)
    : 0;

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            📸 JPEG Image Compressor & Resizer
          </h1>
          <p className="text-gray-600">
            Instantly resize and compress photos without losing quality!
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="mb-6">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <svg className="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500">JPG, PNG, HEIC, WEBP (MAX. 50MB)</p>
              </div>
              <input
                type="file"
                className="hidden"
                accept="image/jpeg,image/jpg,image/png,image/heic,image/webp"
                onChange={handleFileSelect}
              />
            </label>
          </div>

          {selectedFile && (
            <>
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="font-semibold mb-2 text-gray-700">Compression Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quality: {quality}%
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="100"
                        value={quality}
                        onChange={(e) => setQuality(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Width (px)
                      </label>
                      <input
                        type="number"
                        value={maxWidth}
                        onChange={(e) => setMaxWidth(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Height (px)
                      </label>
                      <input
                        type="number"
                        value={maxHeight}
                        onChange={(e) => setMaxHeight(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Output Format
                      </label>
                      <select
                        value={outputFormat}
                        onChange={(e) => setOutputFormat(e.target.value as any)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="jpeg">JPEG</option>
                        <option value="png">PNG</option>
                        <option value="webp">WEBP</option>
                        <option value="pdf">PDF</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2 text-gray-700">Preview</h3>
                  {originalImage && (
                    <div className="border border-gray-300 rounded-lg overflow-hidden">
                      {showCrop ? (
                        <ReactCrop
                          crop={crop}
                          onChange={(c) => setCrop(c)}
                          onComplete={(c) => setCompletedCrop(c)}
                        >
                          <img
                            ref={imgRef}
                            src={originalImage}
                            alt="Original"
                            className="max-w-full h-auto"
                          />
                        </ReactCrop>
                      ) : (
                        <img
                          src={originalImage}
                          alt="Original"
                          className="max-w-full h-auto"
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setShowCrop(!showCrop)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  {showCrop ? '✓ Done Cropping' : '✂️ Crop Image'}
                </button>

                <button
                  onClick={processImage}
                  disabled={isProcessing}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                >
                  {isProcessing ? 'Processing...' : '🚀 Compress & Resize'}
                </button>

                {processedImage && (
                  <button
                    onClick={downloadImage}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    ⬇️ Download
                  </button>
                )}
              </div>

              {compressedSize > 0 && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-sm text-gray-600">Original Size</p>
                      <p className="text-lg font-semibold text-gray-800">{formatBytes(originalSize)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Compressed Size</p>
                      <p className="text-lg font-semibold text-green-600">{formatBytes(compressedSize)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Saved</p>
                      <p className="text-lg font-semibold text-blue-600">{compressionRatio}%</p>
                    </div>
                  </div>
                </div>
              )}

              {processedImage && outputFormat !== 'pdf' && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-2 text-gray-700">Processed Image</h3>
                  <div className="border border-gray-300 rounded-lg overflow-hidden">
                    <img
                      src={processedImage}
                      alt="Processed"
                      className="max-w-full h-auto"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">✨ Features</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-start space-x-3">
              <span className="text-2xl">📸</span>
              <div>
                <h3 className="font-semibold text-gray-800">Multiple Formats</h3>
                <p className="text-sm text-gray-600">Support for JPG, PNG, HEIC, WEBP, PDF</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-2xl">⚡</span>
              <div>
                <h3 className="font-semibold text-gray-800">Lightning Fast</h3>
                <p className="text-sm text-gray-600">Process images in seconds offline</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-2xl">✂️</span>
              <div>
                <h3 className="font-semibold text-gray-800">Crop & Resize</h3>
                <p className="text-sm text-gray-600">Easy cropping and custom dimensions</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-2xl">🎨</span>
              <div>
                <h3 className="font-semibold text-gray-800">Quality Control</h3>
                <p className="text-sm text-gray-600">Adjust compression without quality loss</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-2xl">🔒</span>
              <div>
                <h3 className="font-semibold text-gray-800">100% Private</h3>
                <p className="text-sm text-gray-600">All processing happens in your browser</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-2xl">💾</span>
              <div>
                <h3 className="font-semibold text-gray-800">Save Space</h3>
                <p className="text-sm text-gray-600">Reduce file sizes up to 90%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
