import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCanvas } from "@/contexts/CanvasContext";
import {
  ensureFontLoaded,
  getBaseFontName,
  getCanvasFontFamily,
  GOOGLE_FONTS,
  normalizeEditingTextFont,
} from "@/lib/fontLoader";
import {
  Flask,
  ListBullets,
  ListNumbers,
  TextAlignCenter,
  TextAlignLeftIcon,
  TextAlignRight,
  TextB,
  TextItalic,
  TextSubscript,
  TextSuperscript,
  TextTIcon,
  TextUnderline,
} from "@phosphor-icons/react";
import { Textbox } from "fabric";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SpecialCharactersPalette } from "./SpecialCharactersPalette";

export const TextFormattingPanel = () => {
  const {
    textFont,
    setTextFont,
    textAlign,
    setTextAlign,
    textUnderline,
    setTextUnderline,
    textOverline,
    setTextOverline,
    textBold,
    setTextBold,
    textItalic,
    setTextItalic,
    textListType,
    setTextListType,
    textSubscript,
    setTextSubscript,
    textSuperscript,
    setTextSuperscript,
    canvas,
    selectedObject,
  } = useCanvas();

  // Track object modifications to force UI sync
  const [modificationCounter, setModificationCounter] = useState(0);

  // Listen for object:modified events to sync UI
  useEffect(() => {
    if (!canvas) return;

    const handleObjectModified = () => {
      setModificationCounter(prev => prev + 1);
    };

    canvas.on('object:modified', handleObjectModified);

    return () => {
      canvas.off('object:modified', handleObjectModified);
    };
  }, [canvas]);

  // Helper function to get text object from selection
  const getTextObject = (obj: any): Textbox | null => {
    if (obj?.type === "textbox") {
      return obj as Textbox;
    }
    // Check if it's a group containing text
    if (obj?.type === "group") {
      const textObj = obj.getObjects().find((o: any) => o.type === "textbox");
      return (textObj as Textbox) || null;
    }
    return null;
  };

  // Helper functions for list processing
  const removeListFormatting = (text: string): string => {
    return text
      .split("\n")
      .map((line) => line.replace(/^(•\s|\d+\.\s)/, ""))
      .join("\n");
  };

  const applyBulletFormatting = (text: string): string => {
    return text
      .split("\n")
      .map((line) =>
        line.trim() ? `• ${line.replace(/^(•\s|\d+\.\s)/, "")}` : ""
      )
      .join("\n");
  };

  const applyNumberedFormatting = (text: string): string => {
    let counter = 1;
    return text
      .split("\n")
      .map((line) => {
        if (line.trim()) {
          const cleanLine = line.replace(/^(•\s|\d+\.\s)/, "");
          return `${counter++}. ${cleanLine}`;
        }
        return "";
      })
      .join("\n");
  };

  // Update toolbar to reflect selected text object's properties
  useEffect(() => {
    const textObj = getTextObject(selectedObject);
    if (textObj) {
      const baseFont = getBaseFontName(textObj.fontFamily);
      setTextFont(baseFont);
      setTextAlign(textObj.textAlign || "left");
      setTextBold(textObj.fontWeight === "bold");
      setTextItalic(textObj.fontStyle === "italic");
      setTextUnderline(textObj.underline || false);
      setTextOverline(textObj.overline || false);

      // Detect subscript/superscript from current cursor position
      if (textObj.isEditing) {
        const cursorPos = textObj.selectionStart || 0;
        const styles = textObj.getStyleAtPosition(cursorPos, false);

        const baseFontSize = textObj.fontSize || 16;
        const deltaY = (styles as any)?.deltaY || 0;
        const fontSize = (styles as any)?.fontSize || baseFontSize;

        // Check if current style is subscript or superscript
        const isSubscript = deltaY > 0 && fontSize < baseFontSize;
        const isSuperscript = deltaY < 0 && fontSize < baseFontSize;

        setTextSubscript(isSubscript);
        setTextSuperscript(isSuperscript);
      } else {
        setTextSubscript(false);
        setTextSuperscript(false);
      }
    }
  }, [
    selectedObject,
    modificationCounter,
    setTextFont,
    setTextAlign,
    setTextBold,
    setTextItalic,
    setTextUnderline,
    setTextOverline,
    setTextListType,
    setTextSubscript,
    setTextSuperscript,
  ]);

  const handleFontChange = async (font: string) => {
    // Ensure font is loaded before applying
    const loaded = await ensureFontLoaded(font);
    if (!loaded) {
      toast.error(`Font "${font}" failed to load`);
      return;
    }

    const canvasFont = getCanvasFontFamily(font);
    setTextFont(font);
    // Update selected text object if exists
    const textObj = getTextObject(selectedObject);
    if (canvas && textObj) {
      textObj.set({ fontFamily: canvasFont });
      canvas.requestRenderAll();
    }
  };

  const handleBoldChange = () => {
    const newBold = !textBold;
    setTextBold(newBold);
    // Update selected text object if exists
    const textObj = getTextObject(selectedObject);
    if (canvas && textObj) {
      textObj.set({ fontWeight: newBold ? "bold" : "normal" });
      canvas.requestRenderAll();
    }
  };

  const handleItalicChange = () => {
    const newItalic = !textItalic;
    setTextItalic(newItalic);
    // Update selected text object if exists
    const textObj = getTextObject(selectedObject);
    if (canvas && textObj) {
      textObj.set({ fontStyle: newItalic ? "italic" : "normal" });
      canvas.requestRenderAll();
    }
  };

  const handleAlignChange = (align: string) => {
    setTextAlign(align);
    // Update selected text object if exists
    const textObj = getTextObject(selectedObject);
    if (canvas && textObj) {
      textObj.set({ textAlign: align as any });
      canvas.requestRenderAll();
    }
  };

  const handleUnderlineChange = () => {
    const newUnderline = !textUnderline;
    setTextUnderline(newUnderline);
    // Update selected text object if exists
    const textObj = getTextObject(selectedObject);
    if (canvas && textObj) {
      textObj.set({ underline: newUnderline });
      canvas.requestRenderAll();
    }
  };

  const handleOverlineChange = () => {
    const newOverline = !textOverline;
    setTextOverline(newOverline);
    // Update selected text object if exists
    const textObj = getTextObject(selectedObject);
    if (canvas && textObj) {
      textObj.set({ overline: newOverline });
      canvas.requestRenderAll();
    }
  };

  const handleListTypeChange = (type: "none" | "bullet" | "numbered") => {
    setTextListType(type);
    // Update selected text object if exists
    const textObj = getTextObject(selectedObject);
    if (canvas && textObj) {
      let newText = textObj.text || "";

      // Remove existing list formatting
      newText = removeListFormatting(newText);

      // Apply new formatting based on type
      if (type === "bullet") {
        newText = applyBulletFormatting(newText);
      } else if (type === "numbered") {
        newText = applyNumberedFormatting(newText);
      }

      // Store list type and update text
      (textObj as any).listType = type;
      textObj.set({ text: newText });
      canvas.requestRenderAll();
    }
  };

  const handleSubscriptChange = () => {
    const newSubscript = !textSubscript;
    setTextSubscript(newSubscript);

    if (newSubscript) {
      setTextSuperscript(false);
    }

    const textObj = getTextObject(selectedObject);
    if (canvas && textObj) {
      // Normalize font BEFORE applying subscript for special character support
      normalizeEditingTextFont(textObj);

      // If not in editing mode, enter it and select all text
      if (!textObj.isEditing) {
        textObj.enterEditing();
        textObj.selectAll();
      }

      const selectionStart = textObj.selectionStart || 0;
      const selectionEnd = textObj.selectionEnd || 0;
      const baseFontSize = textObj.fontSize || 16;

      if (selectionStart !== selectionEnd) {
        // Apply to selection
        for (let i = selectionStart; i < selectionEnd; i++) {
          textObj.setSelectionStyles(
            {
              fontSize: newSubscript ? baseFontSize * 0.7 : baseFontSize,
              deltaY: newSubscript ? baseFontSize * 0.3 : 0,
            },
            i,
            i + 1
          );
        }
      } else {
        // No selection, set for future typing
        textObj.setSelectionStyles({
          fontSize: newSubscript ? baseFontSize * 0.7 : baseFontSize,
          deltaY: newSubscript ? baseFontSize * 0.3 : 0,
        });
      }

      canvas.requestRenderAll();

      // Force layout recalculation for real-time rendering
      if (typeof textObj.initDimensions === "function") {
        textObj.initDimensions();
      }
      if (typeof textObj.setCoords === "function") {
        textObj.setCoords();
      }
      textObj.dirty = true;
      canvas.requestRenderAll();
    }
  };

  const handleSuperscriptChange = () => {
    const newSuperscript = !textSuperscript;
    setTextSuperscript(newSuperscript);

    if (newSuperscript) {
      setTextSubscript(false);
    }

    const textObj = getTextObject(selectedObject);
    if (canvas && textObj) {
      // Normalize font BEFORE applying superscript for special character support
      normalizeEditingTextFont(textObj);

      // If not in editing mode, enter it and select all text
      if (!textObj.isEditing) {
        textObj.enterEditing();
        textObj.selectAll();
      }

      const selectionStart = textObj.selectionStart || 0;
      const selectionEnd = textObj.selectionEnd || 0;
      const baseFontSize = textObj.fontSize || 16;

      if (selectionStart !== selectionEnd) {
        // Apply to selection
        for (let i = selectionStart; i < selectionEnd; i++) {
          textObj.setSelectionStyles(
            {
              fontSize: newSuperscript ? baseFontSize * 0.7 : baseFontSize,
              deltaY: newSuperscript ? -(baseFontSize * 0.3) : 0,
            },
            i,
            i + 1
          );
        }
      } else {
        // No selection, set for future typing
        textObj.setSelectionStyles({
          fontSize: newSuperscript ? baseFontSize * 0.7 : baseFontSize,
          deltaY: newSuperscript ? -(baseFontSize * 0.3) : 0,
        });
      }

      canvas.requestRenderAll();

      // Force layout recalculation for real-time rendering
      if (typeof textObj.initDimensions === "function") {
        textObj.initDimensions();
      }
      if (typeof textObj.setCoords === "function") {
        textObj.setCoords();
      }
      textObj.dirty = true;
      canvas.requestRenderAll();
    }
  };

  const handleScientificPreset = async () => {
    const scientificFont = "STIX Two Text";
    const loaded = await ensureFontLoaded(scientificFont);
    if (!loaded) {
      toast.error(`Font "${scientificFont}" failed to load`);
      return;
    }

    const canvasFont = getCanvasFontFamily(scientificFont);
    setTextFont(scientificFont);

    const textObj = getTextObject(selectedObject);
    if (canvas && textObj) {
      textObj.set({
        fontFamily: canvasFont,
        fontSize: 20,
        lineHeight: 1.4,
      });
      canvas.requestRenderAll();
      toast.success("Scientific text style applied");
    } else {
      toast.info("Select a text object to apply scientific style");
    }
  };

  return (
    <div className="flex items-center gap-1">
      {/* Font Selection */}
      <Select
        value={textFont}
        onValueChange={handleFontChange}
      >
        <SelectTrigger className="w-[140px] h-8 text-xs bg-background">
          <SelectValue placeholder="Select font" />
        </SelectTrigger>
        <SelectContent className="bg-popover z-50">
          {GOOGLE_FONTS.map((font) => (
            <SelectItem
              key={font}
              value={font}
              style={{ fontFamily: font }}
            >
              {font}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="w-px h-6 bg-border mx-1" />

      {/* Text Style */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={textBold ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={handleBoldChange}
          >
            <TextB
              style={{ width: 18, height: 18 }}
              weight={textBold ? "duotone" : "bold"}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Bold</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={textItalic ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={handleItalicChange}
          >
            <TextItalic
              style={{ width: 18, height: 18 }}
              weight={textItalic ? "duotone" : "bold"}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Italic</TooltipContent>
      </Tooltip>

      <div className="w-px h-6 bg-border mx-1" />

      {/* Text Alignment */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={textAlign === "left" ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => handleAlignChange("left")}
          >
            <TextAlignLeftIcon
              style={{ width: 18, height: 18 }}
              weight={textAlign === "left" ? "duotone" : "bold"}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Align Left</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={textAlign === "center" ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => handleAlignChange("center")}
          >
            <TextAlignCenter
              style={{ width: 18, height: 18 }}
              weight={textAlign === "center" ? "duotone" : "bold"}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Align Center</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={textAlign === "right" ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => handleAlignChange("right")}
          >
            <TextAlignRight
              style={{ width: 18, height: 18 }}
              weight={textAlign === "right" ? "duotone" : "bold"}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Align Right</TooltipContent>
      </Tooltip>

      <div className="w-px h-6 bg-border mx-1" />

      {/* Text Decoration */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={textUnderline ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={handleUnderlineChange}
          >
            <TextUnderline
              style={{ width: 18, height: 18 }}
              weight={textUnderline ? "duotone" : "bold"}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Underline</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={textOverline ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8 relative"
            onClick={handleOverlineChange}
          >
            <TextTIcon
              style={{ width: 18, height: 18 }}
              weight={textOverline ? "duotone" : "bold"}
            />
            <div className="absolute top-1.5 left-2 right-2 h-px bg-current" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Overline</TooltipContent>
      </Tooltip>

      {/* Subscript */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={textSubscript ? "default" : "ghost"}
            size="icon"
            onClick={handleSubscriptChange}
            className="h-8 w-8"
          >
            <TextSubscript
              style={{ width: 18, height: 18 }}
              weight={textSubscript ? "duotone" : "bold"}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Subscript (H₂O)</p>
        </TooltipContent>
      </Tooltip>

      {/* Superscript */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={textSuperscript ? "default" : "ghost"}
            size="icon"
            onClick={handleSuperscriptChange}
            className="h-8 w-8"
          >
            <TextSuperscript
              style={{ width: 18, height: 18 }}
              weight={textSuperscript ? "duotone" : "bold"}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Superscript (x²)</p>
        </TooltipContent>
      </Tooltip>

      {/* Special Characters */}
      <SpecialCharactersPalette />

      <div className="w-px h-6 bg-border mx-1" />

      {/* Scientific Text Preset */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleScientificPreset}
          >
            <Flask
              style={{ width: 18, height: 18 }}
              weight="regular"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Scientific Text Style</p>
          <p className="text-xs text-muted-foreground">
            STIX Two Text, optimized for formulas
          </p>
        </TooltipContent>
      </Tooltip>

      <div className="w-px h-6 bg-border mx-1" />

      {/* List Formatting */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={textListType === "bullet" ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() =>
              handleListTypeChange(
                textListType === "bullet" ? "none" : "bullet"
              )
            }
          >
            <ListBullets
              style={{ width: 18, height: 18 }}
              weight={textListType === "bullet" ? "duotone" : "bold"}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Bullet List</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={textListType === "numbered" ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() =>
              handleListTypeChange(
                textListType === "numbered" ? "none" : "numbered"
              )
            }
          >
            <ListNumbers
              style={{ width: 18, height: 18 }}
              weight={textListType === "numbered" ? "duotone" : "bold"}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Numbered List</TooltipContent>
      </Tooltip>
    </div>
  );
};
