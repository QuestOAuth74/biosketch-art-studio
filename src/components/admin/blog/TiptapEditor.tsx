import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Heading from "@tiptap/extension-heading";
import Youtube from "@tiptap/extension-youtube";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { EditorToolbar } from "./EditorToolbar";
import { BlogContentRenderer } from "@/components/blog/BlogContentRenderer";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

interface TiptapEditorProps {
  content: any;
  onChange: (content: any) => void;
  title: string;
  onTitleChange: (title: string) => void;
  showPreview?: boolean;
}

export const TiptapEditor = ({
  content,
  onChange,
  title,
  onTitleChange,
  showPreview = false,
}: TiptapEditorProps) => {
  // Track whether the editor has been hydrated with async content
  const hasHydrated = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Heading.configure({
        levels: [1, 2, 3, 4, 5, 6],
      }),
      Image.configure({
        HTMLAttributes: {
          class: "rounded-lg max-w-full h-auto",
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline",
        },
      }),
      Placeholder.configure({
        placeholder: "Start writing your post... Type '/' for commands",
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Underline,
      TextStyle,
      Color,
      Youtube.configure({
        controls: true,
        nocookie: true,
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: "border-collapse table-auto w-full my-6",
        },
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: "border-b",
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: "border border-border px-4 py-2 text-left font-bold bg-muted",
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: "border border-border px-4 py-2",
        },
      }),
    ],
    content: content || "",
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
    editorProps: {
      attributes: {
        class: "blog-content-modern focus:outline-none max-w-none min-h-[500px] p-8",
      },
    },
  });

  // When content arrives asynchronously (e.g. fetched from Supabase after mount),
  // push it into the editor. Only do this once to avoid overwriting user edits.
  useEffect(() => {
    if (editor && content && !hasHydrated.current) {
      // Check if the editor is still empty (initial state)
      const currentContent = editor.getJSON();
      const isEmpty =
        !currentContent.content ||
        currentContent.content.length === 0 ||
        (currentContent.content.length === 1 &&
          currentContent.content[0].type === "paragraph" &&
          (!currentContent.content[0].content || currentContent.content[0].content.length === 0));

      if (isEmpty) {
        editor.commands.setContent(content);
      }
      hasHydrated.current = true;
    }
  }, [editor, content]);

  if (showPreview) {
    return (
      <Card className="p-8">
        <h1 className="text-4xl font-bold mb-8">{title || "Untitled Post"}</h1>
        <BlogContentRenderer content={content} />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Title Input */}
      <Input
        type="text"
        placeholder="Post title..."
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        className="text-4xl font-bold border-0 focus-visible:ring-0 px-0 h-auto py-2"
      />

      {/* Editor Toolbar */}
      {editor && <EditorToolbar editor={editor} />}

      {/* Editor Content */}
      <Card className="border-2 focus-within:border-primary transition-colors">
        <EditorContent editor={editor} />
      </Card>

      {/* Word Count */}
      {editor && (
        <div className="text-sm text-muted-foreground text-right">
          {editor.storage.characterCount?.words() || 0} words
          {" • "}
          {Math.ceil((editor.storage.characterCount?.words() || 0) / 200)} min read
        </div>
      )}
    </div>
  );
};
