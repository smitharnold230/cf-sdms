'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onUpload: (file: File, metadata: FileMetadata) => Promise<void>;
  accept?: string;
  maxSize?: number; // in MB
  allowedTypes?: string[];
  className?: string;
}

interface FileMetadata {
  title: string;
  issued_date: string;
  description?: string;
}

interface UploadProgress {
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

export default function FileUpload({
  onFileSelect,
  onUpload,
  accept = '.pdf',
  maxSize = 10,
  allowedTypes = ['application/pdf'],
  className = ''
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [showMetadataForm, setShowMetadataForm] = useState(false);
  const [metadata, setMetadata] = useState<FileMetadata>({
    title: '',
    issued_date: new Date().toISOString().split('T')[0],
    description: ''
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!allowedTypes.includes(file.type)) {
      return `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`;
    }

    // Check file size
    const sizeInMB = file.size / (1024 * 1024);
    if (sizeInMB > maxSize) {
      return `File size too large. Maximum size: ${maxSize}MB`;
    }

    return null;
  };

  const handleFileSelect = useCallback((file: File) => {
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    setSelectedFile(file);
    setMetadata(prev => ({
      ...prev,
      title: file.name.replace(/\.[^/.]+$/, '') // Remove file extension
    }));
    setShowMetadataForm(true);
    onFileSelect(file);
  }, [onFileSelect, maxSize, allowedTypes]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    if (!metadata.title.trim()) {
      toast.error('Please enter a title for the certificate');
      return;
    }

    try {
      setUploadProgress({
        file: selectedFile,
        progress: 0,
        status: 'uploading'
      });

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (!prev || prev.progress >= 90) return prev;
          return { ...prev, progress: prev.progress + 10 };
        });
      }, 200);

      await onUpload(selectedFile, metadata);

      clearInterval(progressInterval);
      setUploadProgress(prev => prev ? { ...prev, progress: 100, status: 'success' } : null);
      
      toast.success('Certificate uploaded successfully!');
      
      // Reset form after success
      setTimeout(() => {
        setSelectedFile(null);
        setUploadProgress(null);
        setShowMetadataForm(false);
        setMetadata({
          title: '',
          issued_date: new Date().toISOString().split('T')[0],
          description: ''
        });
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 2000);

    } catch (error: any) {
      setUploadProgress(prev => prev ? {
        ...prev,
        status: 'error',
        error: error.message || 'Upload failed'
      } : null);
      toast.error(error.message || 'Upload failed');
    }
  };

  const cancelUpload = () => {
    setSelectedFile(null);
    setUploadProgress(null);
    setShowMetadataForm(false);
    setMetadata({
      title: '',
      issued_date: new Date().toISOString().split('T')[0],
      description: ''
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      {!selectedFile && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragOver 
              ? 'border-primary-500 bg-primary-50' 
              : 'border-gray-300 hover:border-gray-400'
            }
          `}
        >
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Upload Certificate
          </h3>
          <p className="text-gray-600 mb-4">
            Drag and drop your PDF file here, or click to browse
          </p>
          <p className="text-sm text-gray-500">
            Maximum file size: {maxSize}MB • Accepted formats: PDF
          </p>
          
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>
      )}

      {/* Selected File & Metadata Form */}
      {selectedFile && showMetadataForm && !uploadProgress && (
        <div className="border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Certificate Details</h3>
            <button
              onClick={cancelUpload}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* File Info */}
          <div className="flex items-center space-x-3 mb-6 p-3 bg-gray-50 rounded-lg">
            <FileText className="w-8 h-8 text-primary-600" />
            <div className="flex-1">
              <p className="font-medium text-gray-900">{selectedFile.name}</p>
              <p className="text-sm text-gray-500">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
          </div>

          {/* Metadata Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Certificate Title *
              </label>
              <input
                type="text"
                value={metadata.title}
                onChange={(e) => setMetadata(prev => ({ ...prev, title: e.target.value }))}
                className="input"
                placeholder="e.g., Web Development Certification"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Issue Date *
              </label>
              <input
                type="date"
                value={metadata.issued_date}
                onChange={(e) => setMetadata(prev => ({ ...prev, issued_date: e.target.value }))}
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (Optional)
              </label>
              <textarea
                value={metadata.description}
                onChange={(e) => setMetadata(prev => ({ ...prev, description: e.target.value }))}
                className="input"
                rows={3}
                placeholder="Additional details about the certificate..."
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelUpload}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                className="btn btn-primary"
                disabled={!metadata.title.trim()}
              >
                Upload Certificate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {uploadProgress && (
        <div className="border border-gray-200 rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <FileText className="w-8 h-8 text-primary-600" />
            <div className="flex-1">
              <p className="font-medium text-gray-900">{uploadProgress.file.name}</p>
              <p className="text-sm text-gray-500">
                {uploadProgress.status === 'uploading' && `Uploading... ${uploadProgress.progress}%`}
                {uploadProgress.status === 'success' && 'Upload completed successfully!'}
                {uploadProgress.status === 'error' && `Error: ${uploadProgress.error}`}
              </p>
            </div>
            {uploadProgress.status === 'success' && (
              <CheckCircle className="w-6 h-6 text-green-500" />
            )}
            {uploadProgress.status === 'error' && (
              <AlertCircle className="w-6 h-6 text-red-500" />
            )}
          </div>

          {/* Progress Bar */}
          {uploadProgress.status === 'uploading' && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress.progress}%` }}
              />
            </div>
          )}

          {/* Success/Error Actions */}
          {uploadProgress.status !== 'uploading' && (
            <div className="flex justify-end mt-4">
              {uploadProgress.status === 'error' && (
                <button
                  onClick={handleUpload}
                  className="btn btn-primary mr-2"
                >
                  Retry Upload
                </button>
              )}
              <button
                onClick={cancelUpload}
                className="btn btn-secondary"
              >
                {uploadProgress.status === 'success' ? 'Upload Another' : 'Cancel'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}