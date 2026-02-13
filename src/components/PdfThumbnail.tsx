import { useEffect, useRef, useState } from "react";
import { Loader2, FileText } from "lucide-react";

interface PdfThumbnailProps {
  url: string;
  className?: string;
}

export default function PdfThumbnail({ url, className = "" }: PdfThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

        const pdf = await pdfjsLib.getDocument(url).promise;
        if (cancelled) return;

        const page = await pdf.getPage(1);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const container = canvas.parentElement;
        const containerWidth = container?.clientWidth || 120;
        const containerHeight = container?.clientHeight || 80;

        const viewport = page.getViewport({ scale: 1 });
        const scale = Math.min(containerWidth / viewport.width, containerHeight / viewport.height);
        const scaledViewport = page.getViewport({ scale });

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    render();
    return () => { cancelled = true; };
  }, [url]);

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center gap-1 text-muted-foreground ${className}`}>
        <FileText className="h-7 w-7" />
        <span className="text-[10px] uppercase tracking-wider">PDF</span>
      </div>
    );
  }

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground absolute" />}
      <canvas ref={canvasRef} className={`max-w-full max-h-full ${loading ? "opacity-0" : "opacity-100"} transition-opacity`} />
    </div>
  );
}
