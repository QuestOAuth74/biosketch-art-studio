import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MediaUploader } from "./MediaUploader";
import { CategoryManager } from "./CategoryManager";
import { TagInput } from "./TagInput";
import { SEOPreview } from "./SEOPreview";
import { Button } from "@/components/ui/button";
import { Image, X } from "lucide-react";

interface PostSettingsProps {
  formData: any;
  onChange: (data: any) => void;
}

export const PostSettings = ({ formData, onChange }: PostSettingsProps) => {
  return (
    <Card className="sticky top-32">
      <CardHeader>
        <CardTitle>Post Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" defaultValue={["status", "featured", "categories", "seo"]} className="w-full">
          {/* Status & Publishing */}
          <AccordionItem value="status">
            <AccordionTrigger>Status & Publishing</AccordionTrigger>
            <AccordionContent className="space-y-4">
              <RadioGroup
                value={formData.status}
                onValueChange={(value) => onChange({ ...formData, status: value })}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="draft" id="draft" />
                  <Label htmlFor="draft">Draft</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="published" id="published" />
                  <Label htmlFor="published">Published</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="scheduled" id="scheduled" />
                  <Label htmlFor="scheduled">Scheduled</Label>
                </div>
              </RadioGroup>

              {formData.status === "scheduled" && (
                <div>
                  <Label>Schedule For</Label>
                  <Input
                    type="datetime-local"
                    value={formData.scheduled_for || ""}
                    onChange={(e) =>
                      onChange({ ...formData, scheduled_for: e.target.value })
                    }
                  />
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Featured Image */}
          <AccordionItem value="featured">
            <AccordionTrigger>Featured Image</AccordionTrigger>
            <AccordionContent className="space-y-4">
              {formData.featured_image_url ? (
                <div className="relative">
                  <img
                    src={formData.featured_image_url}
                    alt="Featured"
                    className="w-full rounded-lg border"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() =>
                      onChange({
                        ...formData,
                        featured_image_url: "",
                        featured_image_alt: "",
                      })
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <MediaUploader
                  onUpload={(url) =>
                    onChange({ ...formData, featured_image_url: url })
                  }
                >
                  <Button variant="outline" className="w-full">
                    <Image className="h-4 w-4 mr-2" />
                    Upload Featured Image
                  </Button>
                </MediaUploader>
              )}

              {formData.featured_image_url && (
                <div>
                  <Label>Alt Text</Label>
                  <Input
                    placeholder="Describe the image..."
                    value={formData.featured_image_alt || ""}
                    onChange={(e) =>
                      onChange({ ...formData, featured_image_alt: e.target.value })
                    }
                  />
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Categories */}
          <AccordionItem value="categories">
            <AccordionTrigger>Categories</AccordionTrigger>
            <AccordionContent>
              <CategoryManager
                selectedCategories={formData.categories || []}
                onChange={(categories) =>
                  onChange({ ...formData, categories })
                }
              />
            </AccordionContent>
          </AccordionItem>

          {/* Tags */}
          <AccordionItem value="tags">
            <AccordionTrigger>Tags</AccordionTrigger>
            <AccordionContent>
              <TagInput
                selectedTags={formData.tags || []}
                onChange={(tags) => onChange({ ...formData, tags })}
              />
            </AccordionContent>
          </AccordionItem>

          {/* SEO Settings */}
          <AccordionItem value="seo">
            <AccordionTrigger>SEO Settings</AccordionTrigger>
            <AccordionContent className="space-y-4">
              <div>
                <Label>SEO Title ({(formData.seo_title || "").length}/60)</Label>
                <Input
                  placeholder="Optimized title for search engines..."
                  value={formData.seo_title || ""}
                  onChange={(e) =>
                    onChange({ ...formData, seo_title: e.target.value })
                  }
                  maxLength={60}
                />
              </div>

              <div>
                <Label>
                  SEO Description ({(formData.seo_description || "").length}/160)
                </Label>
                <Textarea
                  placeholder="Brief description for search results..."
                  value={formData.seo_description || ""}
                  onChange={(e) =>
                    onChange({ ...formData, seo_description: e.target.value })
                  }
                  maxLength={160}
                  rows={3}
                />
              </div>

              <div>
                <Label>Keywords (comma-separated)</Label>
                <Input
                  placeholder="keyword1, keyword2, keyword3"
                  value={formData.seo_keywords?.join(", ") || ""}
                  onChange={(e) =>
                    onChange({
                      ...formData,
                      seo_keywords: e.target.value.split(",").map((k) => k.trim()),
                    })
                  }
                />
              </div>

              <SEOPreview
                title={formData.seo_title || formData.title}
                description={formData.seo_description || formData.excerpt}
                slug={formData.slug}
              />
            </AccordionContent>
          </AccordionItem>

          {/* Advanced */}
          <AccordionItem value="advanced">
            <AccordionTrigger>Advanced</AccordionTrigger>
            <AccordionContent className="space-y-4">
              <div>
                <Label>Slug</Label>
                <Input
                  placeholder="post-url-slug"
                  value={formData.slug || ""}
                  onChange={(e) =>
                    onChange({ ...formData, slug: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty to auto-generate from title
                </p>
              </div>

              <div>
                <Label>Excerpt</Label>
                <Textarea
                  placeholder="Brief summary of the post..."
                  value={formData.excerpt || ""}
                  onChange={(e) =>
                    onChange({ ...formData, excerpt: e.target.value })
                  }
                  rows={3}
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
};
