import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  MousePointerClick,
  Quote,
  Redo,
  Strikethrough,
  Table2,
  Underline,
  Undo,
  Youtube,
} from "lucide-react";
import { useState } from "react";
import { MediaUploader } from "./MediaUploader";

interface EditorToolbarProps {
  editor: Editor;
}

export const EditorToolbar = ({ editor }: EditorToolbarProps) => {
  const [linkUrl, setLinkUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showYoutubeDialog, setShowYoutubeDialog] = useState(false);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [showCtaDialog, setShowCtaDialog] = useState(false);
  const [ctaText, setCtaText] = useState("Get Started");
  const [ctaUrl, setCtaUrl] = useState("");

  const handleInsertCta = () => {
    if (!ctaText.trim() || !ctaUrl.trim()) return;
    editor.chain().focus().insertContent(
      `<p data-cta="true"><a href="${ctaUrl.trim()}">${ctaText.trim()}</a></p>`
    ).run();
    setShowCtaDialog(false);
    setCtaText("Get Started");
    setCtaUrl("");
  };

  const handleInsertTable = () => {
    const rows = Math.max(1, Math.min(tableRows, 20));
    const cols = Math.max(1, Math.min(tableCols, 10));
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    setShowTableDialog(false);
    setTableRows(3);
    setTableCols(3);
  };

  const handleImageUpload = (url: string) => {
    editor.chain().focus().setImage({ src: url }).run();
  };

  const handleAddLink = () => {
    if (linkUrl) {
      editor.chain().focus().setLink({ href: linkUrl }).run();
      setLinkUrl("");
      setShowLinkDialog(false);
    }
  };

  const handleAddYoutube = () => {
    if (youtubeUrl) {
      editor.chain().focus().setYoutubeVideo({ src: youtubeUrl }).run();
      setYoutubeUrl("");
      setShowYoutubeDialog(false);
    }
  };

  return (
    <div className="sticky top-16 z-40 bg-background border rounded-lg p-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-1">
        {/* Text Formatting */}
        <Button
          variant={editor.isActive("bold") ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant={editor.isActive("italic") ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant={editor.isActive("underline") ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <Underline className="h-4 w-4" />
        </Button>
        <Button
          variant={editor.isActive("strike") ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </Button>
        <Button
          variant={editor.isActive("code") ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code className="h-4 w-4" />
        </Button>

        <Separator
          orientation="vertical"
          className="h-6"
        />

        {/* Headings */}
        <Button
          variant={
            editor.isActive("heading", { level: 1 }) ? "secondary" : "ghost"
          }
          size="sm"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          variant={
            editor.isActive("heading", { level: 2 }) ? "secondary" : "ghost"
          }
          size="sm"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          variant={
            editor.isActive("heading", { level: 3 }) ? "secondary" : "ghost"
          }
          size="sm"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          <Heading3 className="h-4 w-4" />
        </Button>

        <Separator
          orientation="vertical"
          className="h-6"
        />

        {/* Lists */}
        <Button
          variant={editor.isActive("bulletList") ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant={editor.isActive("orderedList") ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>

        <Separator
          orientation="vertical"
          className="h-6"
        />

        {/* Quote */}
        <Button
          variant={editor.isActive("blockquote") ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </Button>

        <Separator
          orientation="vertical"
          className="h-6"
        />

        {/* Alignment */}
        <Button
          variant={
            editor.isActive({ textAlign: "left" }) ? "secondary" : "ghost"
          }
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          variant={
            editor.isActive({ textAlign: "center" }) ? "secondary" : "ghost"
          }
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          variant={
            editor.isActive({ textAlign: "right" }) ? "secondary" : "ghost"
          }
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight className="h-4 w-4" />
        </Button>
        <Button
          variant={
            editor.isActive({ textAlign: "justify" }) ? "secondary" : "ghost"
          }
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        >
          <AlignJustify className="h-4 w-4" />
        </Button>

        <Separator
          orientation="vertical"
          className="h-6"
        />

        {/* Media */}
        <MediaUploader onUpload={handleImageUpload}>
          <Button
            variant="ghost"
            size="sm"
          >
            <Image className="h-4 w-4" />
          </Button>
        </MediaUploader>

        <Dialog
          open={showLinkDialog}
          onOpenChange={setShowLinkDialog}
        >
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
            >
              <Link2 className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Insert Link</DialogTitle>
              <DialogDescription>Enter the URL for the link</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>URL</Label>
                <Input
                  type="url"
                  placeholder="https://example.com"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddLink()}
                />
              </div>
              <Button
                onClick={handleAddLink}
                className="w-full"
              >
                Insert Link
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={showYoutubeDialog}
          onOpenChange={setShowYoutubeDialog}
        >
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
            >
              <Youtube className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Embed YouTube Video</DialogTitle>
              <DialogDescription>Enter the YouTube video URL</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>YouTube URL</Label>
                <Input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddYoutube()}
                />
              </div>
              <Button
                onClick={handleAddYoutube}
                className="w-full"
              >
                Embed Video
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="h-4 w-4" />
        </Button>

        <Separator
          orientation="vertical"
          className="h-6"
        />

        {/* Table */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
            >
              <Table2 className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setShowTableDialog(true)}>
              Insert Table...
            </DropdownMenuItem>
            {editor.isActive("table") && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().addColumnBefore().run()}
                >
                  Add Column Before
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().addColumnAfter().run()}
                >
                  Add Column After
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().deleteColumn().run()}
                >
                  Delete Column
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().addRowBefore().run()}
                >
                  Add Row Before
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().addRowAfter().run()}
                >
                  Add Row After
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().deleteRow().run()}
                >
                  Delete Row
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().toggleHeaderRow().run()}
                >
                  Toggle Header Row
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().deleteTable().run()}
                  className="text-destructive"
                >
                  Delete Table
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* CTA Button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-xs"
          onClick={() => setShowCtaDialog(true)}
          title="Insert CTA Button"
        >
          <MousePointerClick className="h-4 w-4" />
        </Button>

        {/* Table Size Dialog */}
        <Dialog open={showTableDialog} onOpenChange={setShowTableDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Insert Table</DialogTitle>
              <DialogDescription>Choose the number of rows and columns</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Rows</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={tableRows}
                    onChange={(e) => setTableRows(Number(e.target.value))}
                    onKeyDown={(e) => e.key === "Enter" && handleInsertTable()}
                  />
                </div>
                <div>
                  <Label>Columns</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={tableCols}
                    onChange={(e) => setTableCols(Number(e.target.value))}
                    onKeyDown={(e) => e.key === "Enter" && handleInsertTable()}
                  />
                </div>
              </div>
              <Button onClick={handleInsertTable} className="w-full">
                Insert Table
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* CTA Button Dialog */}
        <Dialog open={showCtaDialog} onOpenChange={setShowCtaDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Insert CTA Button</DialogTitle>
              <DialogDescription>Add a call-to-action button that links to a page</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Button Text</Label>
                <Input
                  placeholder="e.g. Start Creating, Learn More"
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleInsertCta()}
                />
              </div>
              <div>
                <Label>Link URL</Label>
                <Input
                  type="url"
                  placeholder="e.g. /projects, /community, https://..."
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleInsertCta()}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                Use relative paths (e.g. <code className="bg-muted px-1 rounded">/projects</code>) for internal pages or full URLs for external links.
              </div>
              <Button onClick={handleInsertCta} className="w-full" disabled={!ctaText.trim() || !ctaUrl.trim()}>
                Insert Button
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Separator
          orientation="vertical"
          className="h-6"
        />

        {/* Undo/Redo */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
