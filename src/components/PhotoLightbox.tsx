import { Dialog, DialogContent } from "@/components/ui/dialog";

interface PhotoLightboxProps {
  src: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PhotoLightbox({ src, open, onOpenChange }: PhotoLightboxProps) {
  if (!src) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 bg-background/95 backdrop-blur-xl border-border/50">
        <img
          src={src}
          alt=""
          className="w-full h-full max-h-[85vh] object-contain rounded-lg"
        />
      </DialogContent>
    </Dialog>
  );
}
