import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, X } from 'lucide-react';
import { useIconSubmissions } from '@/hooks/useIconSubmissions';
import { generateIconThumbnail } from '@/lib/thumbnailGenerator';
import { toast } from 'sonner';
import { sanitizeSVG } from '@/lib/utils';
import { minifySVG } from '@/lib/svgProcessor';

interface IconSubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: { id: string; name: string }[];
}

export const IconSubmissionDialog = ({ open, onOpenChange, categories }: IconSubmissionDialogProps) => {
  const { submitIcon } = useIconSubmissions();
  const [loading, setLoading] = useState(false);
  const [svgPreview, setSvgPreview] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    svg_content: '',
    description: '',
    usage_rights: '' as any,
    usage_rights_details: '',
  });

  // Validate and fix SVG content
  const validateAndFixSVG = (content: string): string => {
    // Fix namespace issues
    let fixed = content
      .replace(/<ns\d+:svg/g, '<svg')
      .replace(/<\/ns\d+:svg>/g, '</svg>')
      .replace(/xmlns:ns\d+=/g, 'xmlns=')
      .replace(/<(\/?)ns\d+:(\w+)/g, '<$1$2')
      .replace(/ns\d+:/g, '');
    
    // Ensure proper xmlns attribute
    if (!fixed.includes('xmlns="http://www.w3.org/2000/svg"')) {
      fixed = fixed.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    
    // Basic validation
    const parser = new DOMParser();
    const doc = parser.parseFromString(fixed, 'image/svg+xml');
    const parserError = doc.querySelector('parsererror');
    
    if (parserError) {
      throw new Error('Invalid SVG: ' + parserError.textContent);
    }
    
    return fixed;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.svg')) {
      toast.error('Please upload an SVG file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      let svgContent = event.target?.result as string;
      
      // Basic SVG validation
      if (!svgContent.includes('<svg')) {
        toast.error('Invalid SVG file');
        return;
      }

      try {
        // Validate and fix namespace issues
        svgContent = validateAndFixSVG(svgContent);
        // Minify SVG to remove XML declarations, metadata, and reduce size
        const minifiedContent = minifySVG(svgContent);
        setSvgPreview(minifiedContent);
        setFormData(prev => ({ ...prev, svg_content: minifiedContent }));
      } catch (error) {
        console.error('SVG validation error:', error);
        toast.error(error instanceof Error ? error.message : 'Invalid SVG file');
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Please enter an icon name');
      return;
    }

    if (!formData.category) {
      toast.error('Please select a category');
      return;
    }

    if (!formData.svg_content) {
      toast.error('Please upload an SVG file');
      return;
    }

    if (!formData.usage_rights) {
      toast.error('Please select usage rights');
      return;
    }

    setLoading(true);
    try {
      const thumbnail = await generateIconThumbnail(formData.svg_content);
      
      const result = await submitIcon({
        name: formData.name.trim(),
        category: formData.category,
        svg_content: formData.svg_content,
        thumbnail,
        description: formData.description.trim() || undefined,
        usage_rights: formData.usage_rights,
        usage_rights_details: formData.usage_rights_details.trim() || undefined,
      });

      if (result) {
        setFormData({
          name: '',
          category: '',
          svg_content: '',
          description: '',
          usage_rights: '' as any,
          usage_rights_details: '',
        });
        setSvgPreview('');
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error submitting icon:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto stable-dialog">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Suggest an Icon</DialogTitle>
          <DialogDescription>
            Submit an SVG icon to be reviewed and added to our library. All submissions will be reviewed by our team.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* SVG Upload */}
          <div className="space-y-2">
            <Label htmlFor="svg-upload">SVG File *</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              {svgPreview ? (
                <div className="space-y-4">
                  <div 
                    className="w-32 h-32 mx-auto bg-muted rounded-lg flex items-center justify-center"
                    dangerouslySetInnerHTML={{ __html: sanitizeSVG(svgPreview) }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSvgPreview('');
                      setFormData(prev => ({ ...prev, svg_content: '' }));
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                </div>
              ) : (
                <label htmlFor="svg-upload" className="cursor-pointer">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm font-medium mb-2">Click to upload SVG file</p>
                  <p className="text-xs text-muted-foreground">Maximum file size: 2MB</p>
                  <input
                    id="svg-upload"
                    type="file"
                    accept=".svg"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Icon Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Icon Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., DNA Double Helix"
              maxLength={100}
              required
            />
            <p className="text-xs text-muted-foreground">{formData.name.length}/100</p>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Briefly describe what this icon represents..."
              maxLength={500}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">{formData.description.length}/500</p>
          </div>

          {/* Usage Rights */}
          <div className="space-y-2">
            <Label htmlFor="usage-rights">Usage Rights *</Label>
            <Select
              value={formData.usage_rights}
              onValueChange={(value: any) => setFormData(prev => ({ ...prev, usage_rights: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select usage rights" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free_to_share">I created this and it's free to share</SelectItem>
                <SelectItem value="own_rights">I own the rights to this image</SelectItem>
                <SelectItem value="licensed">Licensed under Creative Commons</SelectItem>
                <SelectItem value="public_domain">Public Domain</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Usage Rights Details */}
          {formData.usage_rights && (
            <div className="space-y-2">
              <Label htmlFor="usage-details">
                Additional Rights Information (Optional)
              </Label>
              <Textarea
                id="usage-details"
                value={formData.usage_rights_details}
                onChange={(e) => setFormData(prev => ({ ...prev, usage_rights_details: e.target.value }))}
                placeholder="Provide attribution requirements, license details, or source information..."
                maxLength={300}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">{formData.usage_rights_details.length}/300</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Icon'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
