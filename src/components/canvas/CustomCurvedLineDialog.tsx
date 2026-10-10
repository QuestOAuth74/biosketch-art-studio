import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Minus, ArrowRight, Dot, Square, ArrowLeft } from "lucide-react";

interface CustomCurvedLineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (startMarker: string, endMarker: string) => void;
}

export const CustomCurvedLineDialog = ({
  open,
  onOpenChange,
  onConfirm,
}: CustomCurvedLineDialogProps) => {
  const [startMarker, setStartMarker] = useState<string>('none');
  const [endMarker, setEndMarker] = useState<string>('arrow');

  const handleConfirm = () => {
    onConfirm(startMarker, endMarker);
    onOpenChange(false);
  };

  const markerOptions = [
    { value: 'none', label: 'None', icon: <Minus className="h-4 w-4" /> },
    { value: 'arrow', label: 'Arrow', icon: <ArrowRight className="h-4 w-4" /> },
    { value: 'back-arrow', label: 'Back Arrow', icon: <ArrowLeft className="h-4 w-4" /> },
    { value: 'dot', label: 'Dot', icon: <Dot className="h-4 w-4" /> },
    { value: 'circle', label: 'Circle', icon: <Dot className="h-4 w-4" /> },
    { value: 'bar', label: 'Bar', icon: <Minus className="h-4 w-4" /> },
    { value: 'block', label: 'Block', icon: <Square className="h-4 w-4" /> },
  ];

  const getMarkerSymbol = (marker: string): string => {
    switch (marker) {
      case 'arrow': return '→';
      case 'back-arrow': return '←';
      case 'dot': return '●';
      case 'circle': return '○';
      case 'bar': return '|';
      case 'block': return '■';
      default: return '—';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Custom Curved Line</DialogTitle>
          <DialogDescription>
            Choose different markers for the start and end of your curved line
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="start-marker">Start Marker</Label>
            <Select value={startMarker} onValueChange={setStartMarker}>
              <SelectTrigger id="start-marker">
                <SelectValue placeholder="Select start marker" />
              </SelectTrigger>
              <SelectContent>
                {markerOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      {option.icon}
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="end-marker">End Marker</Label>
            <Select value={endMarker} onValueChange={setEndMarker}>
              <SelectTrigger id="end-marker">
                <SelectValue placeholder="Select end marker" />
              </SelectTrigger>
              <SelectContent>
                {markerOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      {option.icon}
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
            <span className="font-mono text-lg">{getMarkerSymbol(startMarker)}</span>
            <svg className="w-16 h-8" viewBox="0 0 64 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M 4 16 Q 32 4 60 16" stroke="currentColor" strokeWidth="2" fill="none"/>
            </svg>
            <span className="font-mono text-lg">{getMarkerSymbol(endMarker)}</span>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Create Line
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
