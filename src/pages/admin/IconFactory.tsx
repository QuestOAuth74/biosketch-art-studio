import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Loader2, Upload, Check, RefreshCw, Save, X, Wand2, Eraser, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SEOHead } from "@/components/SEO/SEOHead";
import { generateCompressedThumbnail } from "@/utils/thumbnailGenerator";

interface IconCategory {
  id: string;
  name: string;
}

interface GeneratedVariant {
  image: string;
  index: number;
  sizeKB?: number;
}

type StylePreset = "2d-flat" | "3d-rendered" | "line-art" | "biomedical" | "pencil" | "hd-realistic";

const STYLE_OPTIONS: { value: StylePreset; label: string; desc: string }[] = [
  { value: "2d-flat", label: "2D Flat (BioRender)", desc: "Clean flat vector style" },
  { value: "3d-rendered", label: "3D Rendered", desc: "Realistic 3D shading" },
  { value: "line-art", label: "Line Art", desc: "Clean outlines only" },
  { value: "biomedical", label: "Biomedical Vector", desc: "Soft pastel vectors" },
  { value: "pencil", label: "Pencil Sketch", desc: "Hand-drawn style" },
  { value: "hd-realistic", label: "HD Realistic", desc: "Photorealistic with authentic colors" },
];

const COLOR_PALETTES: { value: string; label: string; colors: string[]; hex: string }[] = [
  {
    value: "biorender-classic",
    label: "BioRender Classic",
    colors: ["#7BAFD4", "#F4A6B0", "#B8A9D4", "#A8D5BA", "#F4D6A0"],
    hex: "#7BAFD4, #F4A6B0, #B8A9D4, #A8D5BA, #F4D6A0 — soft muted pastels: dusty blue, blush pink, lavender, sage green, warm cream",
  },
  {
    value: "cell-biology",
    label: "Cell Biology",
    colors: ["#8ECDA6", "#6BBFB5", "#F2E5A0", "#B5D8A0", "#D4ECD0"],
    hex: "#8ECDA6, #6BBFB5, #F2E5A0, #B5D8A0, #D4ECD0 — soft greens, muted teal, pale yellow, sage, mint",
  },
  {
    value: "neuroscience",
    label: "Neuroscience",
    colors: ["#B8A9D4", "#8EADD4", "#C4B8D8", "#D4C4A8", "#A0B8CC"],
    hex: "#B8A9D4, #8EADD4, #C4B8D8, #D4C4A8, #A0B8CC — lavender, soft blue, light purple, warm grey, slate blue",
  },
  {
    value: "immunology",
    label: "Immunology",
    colors: ["#F4A6B0", "#8EADD4", "#F4C4A0", "#E8B4B8", "#A8C8E0"],
    hex: "#F4A6B0, #8EADD4, #F4C4A0, #E8B4B8, #A8C8E0 — coral pink, soft blue, peach, dusty rose, light sky",
  },
  {
    value: "warm-pastels",
    label: "Warm Pastels",
    colors: ["#F4C4A0", "#E8A8A0", "#F4D6A0", "#F0B8A0", "#F4E0C4"],
    hex: "#F4C4A0, #E8A8A0, #F4D6A0, #F0B8A0, #F4E0C4 — peach, salmon, soft gold, warm coral, cream",
  },
  {
    value: "cool-pastels",
    label: "Cool Pastels",
    colors: ["#A0D8C8", "#A8C8E8", "#B8C8D8", "#C0D8E0", "#D0E0D8"],
    hex: "#A0D8C8, #A8C8E8, #B8C8D8, #C0D8E0, #D0E0D8 — mint, sky blue, soft grey-blue, ice blue, pale sage",
  },
  {
    value: "monochrome-blue",
    label: "Monochrome Blue",
    colors: ["#7BAFD4", "#A0C4E0", "#C0D8F0", "#6B9CC0", "#D8E8F4"],
    hex: "#7BAFD4, #A0C4E0, #C0D8F0, #6B9CC0, #D8E8F4 — range of soft muted blues from medium to pale",
  },
  {
    value: "molecular",
    label: "Molecular",
    colors: ["#D4A0A0", "#A0B8D4", "#A8D4A8", "#D4C8A0", "#C0A8D4"],
    hex: "#D4A0A0, #A0B8D4, #A8D4A8, #D4C8A0, #C0A8D4 — muted red, steel blue, soft green, warm tan, light purple",
  },
  {
    value: "custom",
    label: "Custom",
    colors: [],
    hex: "",
  },
];

const VARIANT_COUNTS = [1, 2, 3, 4];

/** Estimate byte size of a base64 data URL and return KB */
const getDataUrlSizeKB = (dataUrl: string): number => {
  const base64 = dataUrl.split(",")[1] || "";
  const bytes = Math.ceil((base64.length * 3) / 4);
  return Math.round(bytes / 1024);
};

/** Resize an image data URL to max dimensions, returns optimized PNG data URL */
const resizeImage = (dataUrl: string, maxSize: number): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w <= maxSize && h <= maxSize) {
        resolve(dataUrl);
        return;
      }
      const scale = maxSize / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/png"));
    };
    img.src = dataUrl;
  });
};

export default function IconFactory() {
  const navigate = useNavigate();

  // Input state
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<StylePreset>("2d-flat");
  const [selectedPalette, setSelectedPalette] = useState("biorender-classic");
  const [colorPalette, setColorPalette] = useState(COLOR_PALETTES[0].hex);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [variantCount, setVariantCount] = useState(4);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [variants, setVariants] = useState<GeneratedVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<number | null>(null);

  // Background removal state
  const [bgRemovedSet, setBgRemovedSet] = useState<Set<number>>(new Set());
  const [removingBgIndex, setRemovingBgIndex] = useState<number | null>(null);

  // Upscale state
  const [upscaledSet, setUpscaledSet] = useState<Set<number>>(new Set());
  const [upscalingIndex, setUpscalingIndex] = useState<number | null>(null);

  // Save state
  const [iconName, setIconName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categories, setCategories] = useState<IconCategory[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from("icon_categories")
      .select("id, name")
      .order("name");
    if (!error && data) setCategories(data);
  };

  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setReferenceImage(dataUrl);
      setReferencePreview(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const clearReference = () => {
    setReferenceImage(null);
    setReferencePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please describe the icon you want to create");
      return;
    }

    setIsGenerating(true);
    setVariants([]);
    setSelectedVariant(null);
    setBgRemovedSet(new Set());
    setUpscaledSet(new Set());

    try {
      const { data, error } = await supabase.functions.invoke("admin-generate-icon", {
        body: {
          prompt: prompt.trim(),
          style,
          colorPalette: colorPalette.trim() || undefined,
          referenceImage: referenceImage || undefined,
          count: variantCount,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const variantsWithSize = (data.variants || []).map((v: GeneratedVariant) => ({
        ...v,
        sizeKB: getDataUrlSizeKB(v.image),
      }));
      setVariants(variantsWithSize);
      if (variantsWithSize.length > 0) {
        setSelectedVariant(0);
        // Auto-fill icon name from prompt
        if (!iconName) {
          setIconName(prompt.trim().slice(0, 60));
        }
      }
      toast.success(`Generated ${data.variants?.length || 0} variants`);
    } catch (error: any) {
      console.error("Generation error:", error);
      if (error.message?.includes("RATE_LIMITED")) {
        toast.error("Rate limited — wait a moment and try again");
      } else {
        toast.error(error.message || "Failed to generate icon");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const removeWhiteBackground = (imageDataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, w, h);
        const d = imageData.data;
        const WHITE_THRESHOLD = 235;

        const isWhitish = (idx: number) =>
          d[idx] > WHITE_THRESHOLD && d[idx + 1] > WHITE_THRESHOLD && d[idx + 2] > WHITE_THRESHOLD;

        // Flood-fill from all border pixels — only removes white connected to edges
        const visited = new Uint8Array(w * h);
        const queue: number[] = [];

        // Seed all border pixels that are white
        for (let x = 0; x < w; x++) {
          const topIdx = x * 4;
          const botIdx = ((h - 1) * w + x) * 4;
          if (isWhitish(topIdx)) queue.push(x);
          if (isWhitish(botIdx)) queue.push((h - 1) * w + x);
        }
        for (let y = 1; y < h - 1; y++) {
          const leftIdx = (y * w) * 4;
          const rightIdx = (y * w + w - 1) * 4;
          if (isWhitish(leftIdx)) queue.push(y * w);
          if (isWhitish(rightIdx)) queue.push(y * w + w - 1);
        }

        // BFS flood fill
        while (queue.length > 0) {
          const pos = queue.pop()!;
          if (visited[pos]) continue;
          visited[pos] = 1;

          const idx = pos * 4;
          if (!isWhitish(idx)) continue;

          // Make transparent
          d[idx + 3] = 0;

          const x = pos % w;
          const y = (pos - x) / w;

          if (x > 0) queue.push(pos - 1);
          if (x < w - 1) queue.push(pos + 1);
          if (y > 0) queue.push(pos - w);
          if (y < h - 1) queue.push(pos + w);
        }

        // Anti-alias pass: soften edges adjacent to removed pixels
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const pos = y * w + x;
            const idx = pos * 4;
            if (d[idx + 3] === 0) continue; // already transparent

            // Check if any neighbor was removed
            let removedNeighbors = 0;
            const neighbors = [
              pos - 1, pos + 1, pos - w, pos + w,
              pos - w - 1, pos - w + 1, pos + w - 1, pos + w + 1,
            ];
            for (const n of neighbors) {
              if (n >= 0 && n < w * h && visited[n]) removedNeighbors++;
            }

            if (removedNeighbors > 0) {
              const brightness = (d[idx] + d[idx + 1] + d[idx + 2]) / 3;
              if (brightness > 200) {
                // Fade based on brightness — lighter pixels near edges become more transparent
                const alpha = Math.round(255 * (1 - (brightness - 200) / 55));
                d[idx + 3] = Math.max(0, Math.min(d[idx + 3], alpha));
              }
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = imageDataUrl;
    });
  };

  const handleRemoveBackground = async (index: number) => {
    setRemovingBgIndex(index);
    try {
      const transparent = await removeWhiteBackground(variants[index].image);
      setVariants((prev) =>
        prev.map((v, i) => (i === index ? { ...v, image: transparent, sizeKB: getDataUrlSizeKB(transparent) } : v))
      );
      setBgRemovedSet((prev) => new Set(prev).add(index));
      toast.success(`Background removed from variant ${index + 1}`);
    } catch {
      toast.error("Failed to remove background");
    } finally {
      setRemovingBgIndex(null);
    }
  };

  const handleRemoveAllBackgrounds = async () => {
    for (let i = 0; i < variants.length; i++) {
      if (!bgRemovedSet.has(i)) {
        await handleRemoveBackground(i);
      }
    }
  };

  /** Upscale image: 2x resolution with sharpening convolution */
  const upscaleImage = (dataUrl: string, scale: number = 2): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const srcW = img.naturalWidth;
        const srcH = img.naturalHeight;
        const dstW = srcW * scale;
        const dstH = srcH * scale;

        // Step 1: Draw upscaled with smooth interpolation
        const canvas = document.createElement("canvas");
        canvas.width = dstW;
        canvas.height = dstH;
        const ctx = canvas.getContext("2d")!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, dstW, dstH);

        // Step 2: Apply unsharp mask for sharpening
        const imageData = ctx.getImageData(0, 0, dstW, dstH);
        const src = imageData.data;

        // Create a blurred copy for unsharp mask
        const blurCanvas = document.createElement("canvas");
        blurCanvas.width = dstW;
        blurCanvas.height = dstH;
        const blurCtx = blurCanvas.getContext("2d")!;
        blurCtx.filter = "blur(1px)";
        blurCtx.drawImage(canvas, 0, 0);
        const blurData = blurCtx.getImageData(0, 0, dstW, dstH).data;

        // Unsharp mask: original + strength * (original - blurred)
        const strength = 0.6;
        for (let i = 0; i < src.length; i += 4) {
          for (let c = 0; c < 3; c++) {
            const diff = src[i + c] - blurData[i + c];
            src[i + c] = Math.max(0, Math.min(255, Math.round(src[i + c] + strength * diff)));
          }
          // Boost saturation slightly
          const r = src[i], g = src[i + 1], b = src[i + 2];
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          const satBoost = 1.15;
          src[i]     = Math.max(0, Math.min(255, Math.round(gray + satBoost * (r - gray))));
          src[i + 1] = Math.max(0, Math.min(255, Math.round(gray + satBoost * (g - gray))));
          src[i + 2] = Math.max(0, Math.min(255, Math.round(gray + satBoost * (b - gray))));
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = dataUrl;
    });
  };

  const handleUpscale = async (index: number) => {
    setUpscalingIndex(index);
    try {
      const upscaled = await upscaleImage(variants[index].image);
      setVariants((prev) =>
        prev.map((v, i) => (i === index ? { ...v, image: upscaled, sizeKB: getDataUrlSizeKB(upscaled) } : v))
      );
      setUpscaledSet((prev) => new Set(prev).add(index));
      toast.success(`Variant ${index + 1} upscaled & sharpened`);
    } catch {
      toast.error("Failed to upscale image");
    } finally {
      setUpscalingIndex(null);
    }
  };

  const handleUpscaleAll = async () => {
    for (let i = 0; i < variants.length; i++) {
      if (!upscaledSet.has(i)) {
        await handleUpscale(i);
      }
    }
  };

  const handleSave = async () => {
    if (selectedVariant === null || !variants[selectedVariant]) {
      toast.error("Please select a variant to save");
      return;
    }
    if (!iconName.trim()) {
      toast.error("Please enter an icon name");
      return;
    }
    if (!selectedCategory) {
      toast.error("Please select a category");
      return;
    }

    setIsSaving(true);
    try {
      const selectedImage = variants[selectedVariant].image;

      // Remove white background using flood-fill from edges
      const transparentImage = bgRemovedSet.has(selectedVariant)
        ? selectedImage
        : await removeWhiteBackground(selectedImage);

      // Resize to max size — 1024 for HD realistic, 512 for other styles
      const maxSize = style === "hd-realistic" ? 1024 : 512;
      const optimizedImage = await resizeImage(transparentImage, maxSize);

      // Get dimensions of the optimized image
      const img = new Image();
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.src = optimizedImage;
      });

      const w = img.naturalWidth;
      const h = img.naturalHeight;

      // Wrap the high-quality PNG in an SVG container — the canvas rendering
      // pipeline detects embedded raster images and loads them as FabricImage
      // directly, preserving full quality with no degradation.
      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <image width="${w}" height="${h}" href="${optimizedImage}" />
</svg>`;

      const savedSizeKB = getDataUrlSizeKB(optimizedImage);
      console.log(`Icon optimized: ${w}x${h}, ~${savedSizeKB} KB`);

      // Generate compressed thumbnail
      const thumbnail = await generateCompressedThumbnail(svgContent, 128);

      const sanitizedName = iconName
        .trim()
        .replace(/[^a-zA-Z0-9\s\-_()]/g, "")
        .replace(/\s+/g, " ")
        .trim();

      const { error } = await supabase.from("icons").insert([
        {
          name: sanitizedName,
          category: selectedCategory,
          svg_content: svgContent,
          thumbnail,
        },
      ]);

      if (error) throw error;

      toast.success(`Icon "${sanitizedName}" saved (${savedSizeKB} KB)`);

      // Reset for next icon
      setVariants([]);
      setSelectedVariant(null);
      setIconName("");
      setPrompt("");
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(error.message || "Failed to save icon");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <SEOHead title="Icon Factory - BioSketch Admin" description="AI Icon Generation Pipeline" noindex />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin")}
            className="rounded-full hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2.5">
            <Wand2 className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold leading-tight">Icon Factory</h1>
              <p className="text-xs text-muted-foreground leading-none">
                AI-powered icon generation pipeline
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Input Controls */}
          <div className="space-y-6">
            {/* Description */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Icon Description</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">What do you want to create?</Label>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g. Mitochondria with visible cristae and double membrane, T-cell receptor complex, CRISPR Cas9 protein..."
                    className="min-h-[80px] text-sm"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Style & Colors */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Style & Colors</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Visual Style</Label>
                  <Select value={style} onValueChange={(v) => setStyle(v as StylePreset)}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STYLE_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          <span className="font-medium">{s.label}</span>
                          <span className="text-muted-foreground ml-2 text-xs">— {s.desc}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Color Palette</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {COLOR_PALETTES.map((p) => (
                      <div
                        key={p.value}
                        className={`cursor-pointer rounded-lg border-2 p-2 transition-all hover:shadow-sm ${
                          selectedPalette === p.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40"
                        }`}
                        onClick={() => {
                          setSelectedPalette(p.value);
                          if (p.value !== "custom") setColorPalette(p.hex);
                          else setColorPalette("");
                        }}
                      >
                        <p className="text-[11px] font-medium mb-1">{p.label}</p>
                        {p.colors.length > 0 ? (
                          <div className="flex gap-1">
                            {p.colors.map((c) => (
                              <div
                                key={c}
                                className="h-4 w-4 rounded-full border border-black/10"
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-muted-foreground">Enter your own</p>
                        )}
                      </div>
                    ))}
                  </div>
                  {selectedPalette === "custom" && (
                    <Input
                      value={colorPalette}
                      onChange={(e) => setColorPalette(e.target.value)}
                      placeholder="e.g. #4A90D9, #7CB342, soft blues and greens..."
                      className="h-9 text-sm mt-2"
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Variants to Generate</Label>
                  <div className="flex gap-2">
                    {VARIANT_COUNTS.map((n) => (
                      <Button
                        key={n}
                        variant={variantCount === n ? "default" : "outline"}
                        size="sm"
                        className="h-8 w-10 text-xs"
                        onClick={() => setVariantCount(n)}
                      >
                        {n}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Reference Image */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Reference Style Image (optional)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Upload an image whose visual style you want the AI to match.
                </p>

                {referencePreview ? (
                  <div className="relative inline-block">
                    <img
                      src={referencePreview}
                      alt="Reference"
                      className="h-32 w-32 object-contain rounded-lg border"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                      onClick={clearReference}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="gap-2 text-sm h-9"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    Upload Reference
                  </Button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleReferenceUpload}
                />
              </CardContent>
            </Card>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full gap-2 h-11"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating {variantCount} variant{variantCount > 1 ? "s" : ""}...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Icon{variantCount > 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>

          {/* Right: Results & Save */}
          <div className="space-y-6">
            {/* Generated Variants */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  Generated Variants
                  {variants.length > 0 && (
                    <div className="flex gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs h-7"
                        onClick={handleUpscaleAll}
                        disabled={isGenerating || upscalingIndex !== null || upscaledSet.size === variants.length}
                      >
                        <ZoomIn className="h-3 w-3" />
                        Upscale All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs h-7"
                        onClick={handleRemoveAllBackgrounds}
                        disabled={isGenerating || removingBgIndex !== null || bgRemovedSet.size === variants.length}
                      >
                        <Eraser className="h-3 w-3" />
                        Remove All BG
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs h-7"
                        onClick={handleGenerate}
                        disabled={isGenerating}
                      >
                        <RefreshCw className="h-3 w-3" />
                        Regenerate
                      </Button>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {variants.length === 0 && !isGenerating ? (
                  <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                    Generated icons will appear here
                  </div>
                ) : isGenerating ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Generating with Gemini...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {variants.map((v, i) => (
                      <div
                        key={i}
                        className={`relative cursor-pointer rounded-lg border-2 p-2 transition-all hover:shadow-md ${
                          selectedVariant === i
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                        onClick={() => setSelectedVariant(i)}
                      >
                        <div className="aspect-square bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] rounded overflow-hidden">
                          <img
                            src={v.image}
                            alt={`Variant ${i + 1}`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <div className="flex gap-1">
                            <Button
                              variant={upscaledSet.has(i) ? "secondary" : "outline"}
                              size="sm"
                              className="gap-1 text-[10px] h-6 px-2"
                              disabled={upscalingIndex === i || upscaledSet.has(i)}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpscale(i);
                              }}
                            >
                              {upscalingIndex === i ? (
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              ) : upscaledSet.has(i) ? (
                                <Check className="h-2.5 w-2.5" />
                              ) : (
                                <ZoomIn className="h-2.5 w-2.5" />
                              )}
                              {upscaledSet.has(i) ? "Upscaled" : "Upscale"}
                            </Button>
                            <Button
                              variant={bgRemovedSet.has(i) ? "secondary" : "outline"}
                              size="sm"
                              className="gap-1 text-[10px] h-6 px-2"
                              disabled={removingBgIndex === i || bgRemovedSet.has(i)}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveBackground(i);
                              }}
                            >
                              {removingBgIndex === i ? (
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              ) : bgRemovedSet.has(i) ? (
                                <Check className="h-2.5 w-2.5" />
                              ) : (
                                <Eraser className="h-2.5 w-2.5" />
                              )}
                              {bgRemovedSet.has(i) ? "BG Removed" : "Remove BG"}
                            </Button>
                          </div>
                          {v.sizeKB != null && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {v.sizeKB} KB
                            </span>
                          )}
                        </div>
                        {selectedVariant === i && (
                          <div className="absolute top-1 right-1">
                            <Badge className="text-[10px] px-1.5 py-0 gap-1">
                              <Check className="h-2.5 w-2.5" />
                              Selected
                            </Badge>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Save to Library */}
            {selectedVariant !== null && variants[selectedVariant] && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Save to Icon Library</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="h-16 w-16 shrink-0 rounded-lg border bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] bg-[length:8px_8px] overflow-hidden">
                      <img
                        src={variants[selectedVariant].image}
                        alt="Selected"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Icon Name</Label>
                        <Input
                          value={iconName}
                          onChange={(e) => setIconName(e.target.value)}
                          placeholder="e.g. Mitochondria"
                          className="h-9 text-sm"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Category</Label>
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.name}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <Button
                    onClick={handleSave}
                    disabled={isSaving || !iconName.trim() || !selectedCategory}
                    className="w-full gap-2"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save to Library
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
