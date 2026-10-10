import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useBlogEditor } from "@/hooks/useBlogEditor";
import { TiptapEditor } from "@/components/admin/blog/TiptapEditor";
import { PostSettings } from "@/components/admin/blog/PostSettings";
import { Button } from "@/components/ui/button";
import { Save, Eye, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

const BlogEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showPreview, setShowPreview] = useState(false);

  const {
    formData,
    setFormData,
    isLoading,
    isSaving,
    savePost,
    publishPost,
    loadPost,
  } = useBlogEditor(id);

  useEffect(() => {
    if (id) {
      loadPost(id);
    }
  }, [id]);

  const handleSave = async () => {
    const success = await savePost();
    if (success) {
      toast({
        title: "Success",
        description: "Draft saved successfully",
      });
    }
  };

  const handlePublish = async () => {
    if (!formData.title || !formData.content) {
      toast({
        title: "Error",
        description: "Title and content are required",
        variant: "destructive",
      });
      return;
    }

    const success = await publishPost();
    if (success) {
      toast({
        title: "Success",
        description: "Post published successfully",
      });
      navigate("/admin/blog");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/admin/blog")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <h1 className="text-lg font-semibold">
                {id ? "Edit Post" : "New Post"}
              </h1>
              {isSaving && (
                <span className="text-sm text-muted-foreground">Saving...</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
              >
                <Eye className="h-4 w-4 mr-2" />
                {showPreview ? "Edit" : "Preview"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
              <Button size="sm" onClick={handlePublish} disabled={isSaving}>
                Publish
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Editor Layout */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Editor Column */}
          <div className="lg:col-span-2">
            <TiptapEditor
              content={formData.content}
              onChange={(content) =>
                setFormData({ ...formData, content })
              }
              title={formData.title}
              onTitleChange={(title) =>
                setFormData({ ...formData, title })
              }
              showPreview={showPreview}
            />
          </div>

          {/* Settings Sidebar */}
          <div className="lg:col-span-1">
            <PostSettings
              formData={formData}
              onChange={setFormData}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogEditor;
