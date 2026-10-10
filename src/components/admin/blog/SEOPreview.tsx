import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe } from "lucide-react";

interface SEOPreviewProps {
  title: string;
  description: string;
  slug?: string;
}

export const SEOPreview = ({ title, description, slug }: SEOPreviewProps) => {
  const displayUrl = `biosketch.app/blog/${slug || "post-slug"}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Google Preview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <div className="text-xs text-green-700">
            {displayUrl}
          </div>
          <div className="text-primary text-lg hover:underline cursor-pointer">
            {title || "Post Title"}
          </div>
          <div className="text-sm text-muted-foreground">
            {description || "Post description will appear here..."}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
