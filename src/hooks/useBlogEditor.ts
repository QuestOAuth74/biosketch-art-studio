import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BlogPost } from "@/types/blog";

interface BlogEditorFormData {
  title: string;
  content: any;
  excerpt?: string;
  featured_image_url?: string;
  featured_image_alt?: string;
  status: 'draft' | 'published' | 'scheduled';
  published_at?: string;
  scheduled_for?: string;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string[];
  og_image?: string;
  slug?: string;
  reading_time?: number;
  categories: string[];
  tags: string[];
}

export const useBlogEditor = (postId?: string) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<BlogEditorFormData>({
    title: "",
    content: null,
    status: "draft",
    categories: [],
    tags: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentPostId, setCurrentPostId] = useState<string | undefined>(postId);

  // Load post data if editing
  const loadPost = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("blog_posts")
        .select(`
          *,
          blog_post_categories(category_id),
          blog_post_tags(tag_id)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;

      setFormData({
        title: data.title,
        content: data.content,
        excerpt: data.excerpt || "",
        featured_image_url: data.featured_image_url || "",
        featured_image_alt: data.featured_image_alt || "",
        status: data.status as 'draft' | 'published' | 'scheduled',
        published_at: data.published_at || undefined,
        scheduled_for: data.scheduled_for || undefined,
        seo_title: data.seo_title || "",
        seo_description: data.seo_description || "",
        seo_keywords: data.seo_keywords || [],
        og_image: data.og_image || "",
        slug: data.slug,
        reading_time: data.reading_time || undefined,
        categories: data.blog_post_categories?.map((c: any) => c.category_id) || [],
        tags: data.blog_post_tags?.map((t: any) => t.tag_id) || [],
      });
      setCurrentPostId(id);
    } catch (error) {
      console.error("Error loading post:", error);
      toast({
        title: "Error",
        description: "Failed to load post",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Calculate reading time from content
  const calculateReadingTime = (content: any): number => {
    if (!content) return 0;
    const text = JSON.stringify(content);
    const words = text.split(/\s+/).length;
    return Math.ceil(words / 200); // Average reading speed: 200 words/minute
  };

  // Generate slug from title
  const generateSlug = async (title: string): Promise<string> => {
    try {
      const { data, error } = await supabase.rpc("generate_blog_slug", {
        title_param: title,
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error generating slug:", error);
      // Fallback to basic slug generation
      return title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim();
    }
  };

  // Upload media to Supabase storage
  const uploadMedia = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("blog-media")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("blog-media")
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error("Error uploading media:", error);
      toast({
        title: "Error",
        description: "Failed to upload media",
        variant: "destructive",
      });
      return null;
    }
  };

  // Save post (create or update)
  const savePost = async (overrideData?: Partial<BlogEditorFormData>): Promise<boolean> => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Merge override data with form data
      const dataToSave = { ...formData, ...overrideData };

      // Generate slug if not exists
      let slug = dataToSave.slug;
      if (!slug && dataToSave.title) {
        slug = await generateSlug(dataToSave.title);
      }

      const reading_time = calculateReadingTime(dataToSave.content);

      const postData = {
        title: dataToSave.title,
        slug,
        content: dataToSave.content || {},
        excerpt: dataToSave.excerpt,
        featured_image_url: dataToSave.featured_image_url,
        featured_image_alt: dataToSave.featured_image_alt,
        status: dataToSave.status,
        published_at: dataToSave.published_at,
        scheduled_for: dataToSave.scheduled_for,
        seo_title: dataToSave.seo_title,
        seo_description: dataToSave.seo_description,
        seo_keywords: dataToSave.seo_keywords,
        og_image: dataToSave.og_image,
        reading_time,
        author_id: user.id,
      };

      let savedPostId = currentPostId;

      if (currentPostId) {
        // Update existing post
        const { error } = await supabase
          .from("blog_posts")
          .update(postData)
          .eq("id", currentPostId);

        if (error) throw error;
      } else {
        // Create new post
        const { data, error } = await supabase
          .from("blog_posts")
          .insert(postData)
          .select()
          .single();

        if (error) throw error;
        savedPostId = data.id;
        setCurrentPostId(data.id);
      }

      // Update categories
      if (savedPostId) {
        await supabase
          .from("blog_post_categories")
          .delete()
          .eq("post_id", savedPostId);

        if (formData.categories.length > 0) {
          await supabase
            .from("blog_post_categories")
            .insert(
              formData.categories.map((cat_id) => ({
                post_id: savedPostId,
                category_id: cat_id,
              }))
            );
        }

        // Update tags
        await supabase
          .from("blog_post_tags")
          .delete()
          .eq("post_id", savedPostId);

        if (formData.tags.length > 0) {
          await supabase
            .from("blog_post_tags")
            .insert(
              formData.tags.map((tag_id) => ({
                post_id: savedPostId,
                tag_id: tag_id,
              }))
            );
        }
      }

      return true;
    } catch (error) {
      console.error("Error saving post:", error);
      toast({
        title: "Error",
        description: "Failed to save post",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Publish post
  const publishPost = async (): Promise<boolean> => {
    const publishedAt = new Date().toISOString();
    
    // Save with explicit publish status
    const success = await savePost({
      status: "published",
      published_at: publishedAt,
    });

    // Update UI state after successful save
    if (success) {
      setFormData((prev) => ({
        ...prev,
        status: "published",
        published_at: publishedAt,
      }));
    }
    
    return success;
  };

  // Auto-save functionality (debounced)
  useEffect(() => {
    if (!formData.title || !currentPostId) return;

    const timer = setTimeout(() => {
      savePost();
    }, 30000); // Auto-save every 30 seconds

    return () => clearTimeout(timer);
  }, [formData, currentPostId]);

  return {
    formData,
    setFormData,
    isLoading,
    isSaving,
    currentPostId,
    savePost,
    publishPost,
    loadPost,
    uploadMedia,
    generateSlug,
  };
};
