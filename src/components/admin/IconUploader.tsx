import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileArchive, AlertTriangle, CheckCircle, Info } from "lucide-react";
import JSZip from "jszip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { sanitizeSVG, minifySVG } from "@/lib/svgProcessor";
import { generateCompressedThumbnail, calculateSvgSize, validateThumbnailSize } from "@/utils/thumbnailGenerator";

interface Category {
  id: string;
  name: string;
}

interface ValidationResult {
  isValid: boolean;
  content?: string;
  error?: string;
  debugInfo?: {
    fileType: string;
    fileSize: number;
    firstChars: string;
    hasXmlDeclaration: boolean;
    hasSvgTag: boolean;
    hasSvgNamespace: boolean;
    detectedPrefix?: string;
  };
}

export const IconUploader = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [iconName, setIconName] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  const [validationWarning, setValidationWarning] = useState<string>("");
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [showDebug, setShowDebug] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [totalToUpload, setTotalToUpload] = useState(0);
  const [failedUploads, setFailedUploads] = useState<string[]>([]);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from('icon_categories')
      .select('*')
      .order('name');

    if (!error && data) {
      setCategories(data);
    }
  };

  // Validate and fix SVG content before upload
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
    
    return fixed;
  };

  // Normalize namespaced SVG for HTML rendering and thumbnail generation
  const normalizeSvgForHtml = (content: string): string => {
    // First fix namespace issues
    content = validateAndFixSVG(content);
    
    // Detect if root uses a namespace prefix (e.g., <ns0:svg xmlns:ns0="...">)
    const prefixMatch = content.match(/<\s*([a-zA-Z_][\w.-]*):svg\b[^>]*xmlns:\1=["']http:\/\/www\.w3\.org\/2000\/svg["']/i);
    
    if (prefixMatch) {
      const prefix = prefixMatch[1];
      console.log(`Normalizing SVG with namespaced root: ${prefix}:svg`);
      
      // Remove the prefix from all element tags
      const prefixRegex = new RegExp(`(<\\/?)${prefix}:`, 'gi');
      content = content.replace(prefixRegex, '$1');
    }
    
    // Ensure default xmlns on root if not present
    if (!/xmlns=["']http:\/\/www\.w3\.org\/2000\/svg["']/i.test(content)) {
      content = content.replace(/<\s*svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    
    return content;
  };

  // Enhanced SVG validation with support for namespaced tags
  const validateSVGContent = (content: string, file: File): ValidationResult => {
    try {
      // Remove BOM if present
      const cleanContent = content.replace(/^\uFEFF/, '');
      
      // Get first 500 characters for debugging
      const preview = cleanContent.substring(0, 500);
      
      // Support both <svg> and <prefix:svg> tags (e.g., <ns0:svg>)
      const hasXmlDeclaration = /^<\?xml/i.test(cleanContent.trim());
      const hasOpenSvgTag = /<\s*(?:[a-zA-Z_][\w.-]*:)?svg\b/i.test(cleanContent);
      const hasCloseSvgTag = /<\/\s*(?:[a-zA-Z_][\w.-]*:)?svg\s*>/i.test(cleanContent);
      const hasSvgNamespace = /xmlns(?:\:[a-zA-Z_][\w.-]*)?=["']http:\/\/www\.w3\.org\/2000\/svg["']/i.test(cleanContent);
      
      // Detect namespaced root (e.g., <ns0:svg>)
      const namespacedMatch = cleanContent.match(/<\s*([a-zA-Z_][\w.-]*):svg\b/i);
      const detectedPrefix = namespacedMatch ? namespacedMatch[1] : undefined;
      
      const debugInfo = {
        fileType: file.type || 'unknown',
        fileSize: file.size,
        firstChars: preview.substring(0, 100),
        hasXmlDeclaration,
        hasSvgTag: hasOpenSvgTag,
        hasSvgNamespace,
        detectedPrefix
      };

      console.log('SVG Validation Debug:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        hasXmlDeclaration,
        hasOpenSvgTag,
        hasCloseSvgTag,
        hasSvgNamespace,
        detectedPrefix,
        firstChars: preview.substring(0, 100)
      });

      // Validation logic
      if (!hasOpenSvgTag) {
        return {
          isValid: false,
          error: "No SVG tag found. This file doesn't contain valid SVG markup.",
          debugInfo
        };
      }

      if (!hasCloseSvgTag) {
        return {
          isValid: false,
          error: "Incomplete SVG file. Missing closing </svg> tag.",
          debugInfo
        };
      }

      if (!hasSvgNamespace) {
        console.warn('SVG missing namespace declaration, but proceeding...');
      }

      return {
        isValid: true,
        content: cleanContent,
        debugInfo
      };
    } catch (error) {
      console.error('Validation error:', error);
      return {
        isValid: false,
        error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  };

  // Try reading file with multiple methods
  const readFileWithFallback = async (file: File): Promise<ValidationResult> => {
    // Method 1: Try reading as text (UTF-8)
    try {
      const textContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsText(file, 'UTF-8');
      });

      return validateSVGContent(textContent, file);
    } catch (error) {
      console.warn('UTF-8 reading failed, trying ArrayBuffer...', error);
    }

    // Method 2: Try reading as ArrayBuffer and manually decode
    try {
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });

      // Try UTF-8 decoding
      const decoder = new TextDecoder('utf-8');
      const textContent = decoder.decode(arrayBuffer);
      
      return validateSVGContent(textContent, file);
    } catch (error) {
      console.error('ArrayBuffer reading failed:', error);
    }

    // Method 3: Try Latin-1 encoding as last resort
    try {
      const textContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsText(file, 'ISO-8859-1');
      });

      return validateSVGContent(textContent, file);
    } catch (error) {
      console.error('All reading methods failed:', error);
    }

    return {
      isValid: false,
      error: 'Failed to read file. The file may be corrupted or in an unsupported format.'
    };
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Check file size (2MB limit)
      if (selectedFile.size > 2 * 1024 * 1024) {
        setValidationWarning("File size must be less than 2MB");
        setFilePreview(null);
        setDebugInfo("");
        return;
      }
      
      setFile(selectedFile);
      setFileSize(selectedFile.size);
      setValidationWarning("");
      setDebugInfo("");
      setFilePreview(null);
      
      // Check file extension first
      if (!selectedFile.name.toLowerCase().endsWith('.svg')) {
        setValidationWarning("File must have .svg extension");
        setDebugInfo(`File type: ${selectedFile.type}, Name: ${selectedFile.name}`);
        return;
      }

      // Validate and preview with enhanced validation
      const result = await readFileWithFallback(selectedFile);
      
      if (!result.isValid) {
        setValidationWarning(result.error || "Invalid SVG file");
        
        if (result.debugInfo) {
          const debugText = `
File Type: ${result.debugInfo.fileType}
File Size: ${(result.debugInfo.fileSize / 1024).toFixed(2)} KB
Has XML Declaration: ${result.debugInfo.hasXmlDeclaration ? 'Yes' : 'No'}
Has SVG Tag: ${result.debugInfo.hasSvgTag ? 'Yes' : 'No'}
Has SVG Namespace: ${result.debugInfo.hasSvgNamespace ? 'Yes' : 'No'}
First 100 characters:
${result.debugInfo.firstChars}
          `.trim();
          setDebugInfo(debugText);
        }
        
        return;
      }
      
      // Success - valid SVG
      setValidationWarning("");
      
      // Use normalized content for preview if namespaced
      const normalizedContent = normalizeSvgForHtml(result.content || "");
      setFilePreview(normalizedContent);
      
      if (result.debugInfo) {
        const debugText = `✓ Valid SVG detected
File Size: ${(result.debugInfo.fileSize / 1024).toFixed(2)} KB
Has XML Declaration: ${result.debugInfo.hasXmlDeclaration ? 'Yes' : 'No'}
Has SVG Namespace: ${result.debugInfo.hasSvgNamespace ? 'Yes' : 'No'}${result.debugInfo.detectedPrefix ? `\nNamespaced Root: ${result.debugInfo.detectedPrefix}:svg (normalized for web)` : ''}`;
        setDebugInfo(debugText);
      }
    }
  };
  
  // Robust SVG validation using DOMParser
  const validateSvgContent = (content: string): { isValid: boolean; normalized: string; error?: string } => {
    try {
      // Remove DOCTYPE and XML declarations for parsing
      const sanitized = content
        .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
        .replace(/<\?xml[^>]*\?>/g, '')
        .trim();
      
      // Quick pre-check
      const lowerContent = sanitized.toLowerCase();
      if (!lowerContent.includes('svg')) {
        return { isValid: false, normalized: content, error: 'No SVG tag found' };
      }
      
      // Use DOMParser for robust validation
      const parser = new DOMParser();
      const doc = parser.parseFromString(sanitized, 'image/svg+xml');
      
      // Check for parsing errors
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        return { isValid: false, normalized: content, error: 'XML parsing error' };
      }
      
      // Check for SVG root element (handle both standard and namespaced)
      let svgElement: Element | null = doc.querySelector('svg');
      if (!svgElement) {
        svgElement = doc.querySelector('[xmlns*="svg"]') || doc.documentElement;
        if (!svgElement || !svgElement.localName?.toLowerCase().includes('svg')) {
          return { isValid: false, normalized: content, error: 'No valid SVG root element' };
        }
      }
      
      // Only normalize if there are actual namespace issues
      let normalized = sanitized;
      const hasNamespaceIssues = /<(\w+:)svg/.test(sanitized);
      
      if (hasNamespaceIssues) {
        // Only apply normalization if we detect namespace prefixes
        console.log('Normalizing SVG with namespace issues');
        normalized = normalized
          .replace(/<(\w+:)svg/g, '<svg')
          .replace(/<\/(\w+:)svg>/g, '</svg>')
          .replace(/(\w+:)(rect|circle|path|polygon|line|polyline|ellipse|g|defs|use|image|text|tspan)/g, '$2');
      }
      
      // Ensure xmlns on root
      if (!/xmlns=["']http:\/\/www\.w3\.org\/2000\/svg["']/i.test(normalized)) {
        normalized = normalized.replace(/<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      
      return { isValid: true, normalized };
    } catch (error) {
      return { isValid: false, normalized: content, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };
  
  // Sanitize filename - enhanced to prevent corrupted names
  const sanitizeFileName = (fileName: string): string => {
    let cleaned = fileName;
    
    // Remove upload metadata patterns
    cleaned = cleaned.replace(/^\d+_[a-zA-Z0-9]+_\d+_[a-zA-Z0-9]+_/, '');
    
    // Try to decode Base64 encoded paths
    if (cleaned.includes('_L2hvbWU') || cleaned.includes('_na1fn_')) {
      const base64Match = cleaned.match(/_(L2[a-zA-Z0-9+/=]+)/);
      if (base64Match) {
        try {
          const decoded = atob(base64Match[1]);
          const pathParts = decoded.split('/');
          cleaned = pathParts[pathParts.length - 1] || cleaned;
        } catch (e) {
          console.warn('Failed to decode base64 in filename');
        }
      }
    }
    
    // Convert camelCase/PascalCase to readable text
    cleaned = cleaned
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
    
    // Standard sanitization
    cleaned = cleaned
      .replace(/[^a-zA-Z0-9-_\s]/g, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\d{4,}/g, '') // Remove long numbers
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .substring(0, 100);
    
    return cleaned || 'Unnamed Icon';
  };

  // Generate optimized thumbnail from full SVG (target max 50KB)
  const generateThumbnail = (svgContent: string): string | null => {
    try {
      // Step 1: Remove only XML declarations, DOCTYPE, comments, metadata - keep xmlns:xlink and defs
      let optimized = svgContent
        .replace(/<\?xml[^>]*\?>/g, '')
        .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<metadata[\s\S]*?<\/metadata>/gi, '')
        .replace(/<title>[\s\S]*?<\/title>/gi, '')
        .replace(/<desc>[\s\S]*?<\/desc>/gi, '')
        .trim();

      // Step 2: Ensure viewBox exists
      const viewBoxMatch = optimized.match(/viewBox=["']([^"']*)["']/);
      const widthMatch = optimized.match(/width=["']([^"']*)["']/);
      const heightMatch = optimized.match(/height=["']([^"']*)["']/);

      if (!viewBoxMatch && widthMatch && heightMatch) {
        const width = parseFloat(widthMatch[1]);
        const height = parseFloat(heightMatch[1]);
        if (!isNaN(width) && !isNaN(height)) {
          optimized = optimized.replace('<svg', `<svg viewBox="0 0 ${width} ${height}"`);
        }
      }

      // Step 3: Remove only non-essential attributes (KEEP style and class for colors!)
      optimized = optimized
        .replace(/\s+id=["'][^"']*["']/g, '')
        .replace(/\s+data-[^=]*=["'][^"']*["']/g, '');
      // DO NOT remove style="" or class="" - they contain critical color/styling info!

      // Step 4: Reduce decimal precision aggressively
      optimized = optimized.replace(/(\d+\.\d{2,})/g, (match) => parseFloat(match).toFixed(1));

      // Step 5: Remove whitespace
      optimized = optimized
        .replace(/\s+/g, ' ')
        .replace(/>\s+</g, '><')
        .trim();

      // Step 6: Validate result is still valid SVG (support namespaced tags)
      if (!/<\s*(?:\w+:)?svg[\s\S]*<\/\s*(?:\w+:)?svg\s*>/i.test(optimized)) {
        console.warn('Optimization produced invalid SVG, using original');
        return svgContent; // Return original instead of null
      }

      console.log(`Thumbnail optimized: ${svgContent.length} → ${optimized.length} bytes`);
      return optimized;
    } catch (error) {
      console.error('Thumbnail generation error:', error);
      return null;
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedCategory || !iconName) {
      toast.error("Please fill all fields");
      return;
    }

    if (validationWarning) {
      toast.error("Please fix validation errors before uploading");
      return;
    }

    setIsUploading(true);
    
    try {
      const result = await readFileWithFallback(file);
      
      if (!result.isValid || !result.content) {
        toast.error(result.error || "Invalid SVG file");
        setIsUploading(false);
        return;
      }
      
      // Use original content for storage, normalized for thumbnail
      const originalContent = result.content;
      // Minify SVG to reduce storage size and bandwidth
      const minifiedContent = minifySVG(originalContent);
      const normalizedContent = normalizeSvgForHtml(result.content);

      // Generate PNG thumbnail (target: 5-20 KB vs 200-300 KB full SVG)
      const compressedThumbnail = await generateCompressedThumbnail(normalizedContent, 128);
      const thumbnailSize = calculateSvgSize(compressedThumbnail);
      console.log(`Generated PNG thumbnail: ${thumbnailSize.toFixed(2)} KB`);

      const sanitizedName = sanitizeFileName(iconName);

      const { error } = await supabase
        .from('icons')
        .insert([{
          name: sanitizedName,
          category: selectedCategory,
          svg_content: minifiedContent,
          thumbnail: compressedThumbnail
        }]);

      if (error) {
        toast.error("Failed to upload icon");
        console.error(error);
      } else {
        toast.success(`Icon "${sanitizedName}" uploaded successfully!`);
        setIconName("");
        setFile(null);
        setFilePreview(null);
        setValidationWarning("");
        setDebugInfo("");
        setSelectedCategory("");
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error("Failed to upload icon");
    } finally {
      setIsUploading(false);
    }
  };

  const handleZipUpload = async () => {
    if (!zipFile || !selectedCategory) {
      toast.error("Please select a ZIP file and category");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setFailedUploads([]);
    
    try {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(zipFile);
      let uploadedCount = 0;
      const failedIcons: string[] = [];

      const svgFiles = Object.keys(zipContent.files).filter(
        (filename) => filename.toLowerCase().endsWith('.svg') && !filename.startsWith('__MACOSX')
      );

      setTotalToUpload(svgFiles.length);

      // Process icons in batches for better performance
      const BATCH_SIZE = 10;
      const batches: string[][] = [];
      
      for (let i = 0; i < svgFiles.length; i += BATCH_SIZE) {
        batches.push(svgFiles.slice(i, i + BATCH_SIZE));
      }

      // Process each batch sequentially, but items within batch in parallel
      for (const batch of batches) {
        await Promise.all(
          batch.map(async (filename) => {
            const file = zipContent.files[filename];
            if (file.dir) return;

            try {
              const content = await file.async('text');
              
              // Use robust validation
              const validation = validateSvgContent(content);
              if (!validation.isValid) {
                console.warn(`Skipping invalid SVG (${validation.error}):`, filename);
                failedIcons.push(`${filename} (${validation.error})`);
                return;
              }
              
              const sanitized = validation.normalized;
              const rawName = filename.split('/').pop()?.replace('.svg', '') || `icon-${Date.now()}`;
              const iconName = sanitizeFileName(rawName);

              // Generate PNG thumbnail (target: 5-20 KB vs 200-300 KB full SVG)
              const compressedThumbnail = await generateCompressedThumbnail(sanitized, 128);

              // Minify SVG to reduce storage size and bandwidth
              const minifiedContent = minifySVG(content);

              const { error } = await supabase
                .from('icons')
                .insert([{
                  name: iconName,
                  category: selectedCategory,
                  svg_content: minifiedContent,
                  thumbnail: compressedThumbnail
                }]);

              if (!error) {
                uploadedCount++;
              } else {
                console.error('Failed to upload:', iconName, error);
                failedIcons.push(iconName);
              }
            } catch (error) {
              console.error('Error processing:', filename, error);
              failedIcons.push(filename);
            }
          })
        );

        // Update progress after each batch
        setUploadProgress((prev) => prev + batch.length);
      }

      // Show results
      if (failedIcons.length > 0) {
        toast.warning(`Uploaded ${uploadedCount} icons. Failed: ${failedIcons.length}`, {
          description: 'Check console for details'
        });
        setFailedUploads(failedIcons);
        console.group('Failed SVG Uploads');
        failedIcons.forEach(failure => console.warn(failure));
        console.groupEnd();
      } else {
        toast.success(`Successfully uploaded ${uploadedCount} icons!`);
      }

      setZipFile(null);
      setSelectedCategory("");
    } catch (error) {
      console.error('Error processing ZIP file:', error);
      toast.error("Failed to process ZIP file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleZipFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setZipFile(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Single Icon Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Single Icon</CardTitle>
          <CardDescription>
            Upload SVG files to your icon library
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="icon-name">Icon Name</Label>
            <Input
              id="icon-name"
              placeholder="e.g., Cell Membrane"
              value={iconName}
              onChange={(e) => setIconName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Icon File (SVG)</Label>
            <Input
              id="file"
              type="file"
              accept=".svg"
              onChange={handleFileChange}
            />
            {fileSize > 0 && (
              <p className="text-xs text-muted-foreground">
                File size: {(fileSize / 1024).toFixed(2)} KB
              </p>
            )}
          </div>

          {validationWarning && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">{validationWarning}</p>
                  {debugInfo && (
                    <Collapsible open={showDebug} onOpenChange={setShowDebug}>
                      <CollapsibleTrigger className="flex items-center gap-2 text-xs hover:underline">
                        <Info className="h-3 w-3" />
                        {showDebug ? 'Hide' : 'Show'} Debug Info
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap">
                          {debugInfo}
                        </pre>
                        <p className="mt-2 text-xs text-muted-foreground">
                          💡 Try re-exporting the SVG from your design tool or opening it in a text editor to verify its structure.
                        </p>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {!validationWarning && debugInfo && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <Collapsible open={showDebug} onOpenChange={setShowDebug}>
                  <CollapsibleTrigger className="flex items-center gap-2 text-xs hover:underline">
                    <Info className="h-3 w-3" />
                    {showDebug ? 'Hide' : 'Show'} Validation Details
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap">
                      {debugInfo}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>
              </AlertDescription>
            </Alert>
          )}

          {filePreview && (
            <div className="border border-border rounded-lg p-4">
              <Label className="text-sm font-medium mb-2 block">Preview:</Label>
              <div className="w-24 h-24 mx-auto border border-border rounded-lg p-2 flex items-center justify-center bg-muted">
                <div 
                  dangerouslySetInnerHTML={{ __html: sanitizeSVG(filePreview) }}
                  className="w-full h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain"
                />
              </div>
            </div>
          )}

          <Button 
            onClick={handleUpload} 
            className="w-full" 
            disabled={isUploading || !file || !!validationWarning}
          >
            <Upload className="h-4 w-4 mr-2" />
            {isUploading ? "Uploading..." : "Upload Icon"}
          </Button>
        </CardContent>
      </Card>

      {/* Bulk ZIP Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Bulk Upload from ZIP</CardTitle>
          <CardDescription>
            Upload a ZIP file containing multiple SVG files. All icons will be added to the selected category.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="zip-category">Category</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="zip-file">ZIP File (containing SVG files)</Label>
            <Input
              id="zip-file"
              type="file"
              accept=".zip"
              onChange={handleZipFileChange}
            />
          </div>

          {isUploading && totalToUpload > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading icons...</span>
                <span>{uploadProgress} / {totalToUpload}</span>
              </div>
              <Progress value={(uploadProgress / totalToUpload) * 100} />
            </div>
          )}

          {failedUploads.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold">Some icons failed to upload:</p>
                <ul className="text-xs mt-2 max-h-20 overflow-y-auto">
                  {failedUploads.map((name, i) => (
                    <li key={i}>• {name}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <Button 
            onClick={handleZipUpload} 
            className="w-full" 
            disabled={isUploading}
          >
            <FileArchive className="h-4 w-4 mr-2" />
            {isUploading ? "Uploading..." : "Upload ZIP"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
