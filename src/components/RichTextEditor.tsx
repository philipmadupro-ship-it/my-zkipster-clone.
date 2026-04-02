'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import 'react-quill/dist/quill.snow.css';

// Lazy-load the editor itself with no SSR
const QuillWrapper = dynamic(() => import('react-quill'), { 
  ssr: false,
  loading: () => <div className="h-24 bg-gray-900 border border-gray-800 rounded-lg animate-pulse flex items-center justify-center text-[10px] text-gray-600">Initializing editor...</div>
});

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * A robust, React 19-safe wrapper for ReactQuill.
 * Ensures the library and its styles are only manipulated on the client-side
 * after the component has fully mounted to prevent hydration mismatches.
 */
export default function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-24 bg-gray-900 border border-gray-800 rounded-lg animate-pulse flex items-center justify-center text-[10px] text-gray-600">Loading editor...</div>;
  }

  return (
    <div className={className}>
      <QuillWrapper
        theme="snow"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        modules={{
          toolbar: [
            ['bold', 'italic', 'underline'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['clean']
          ]
        }}
      />
    </div>
  );
}
