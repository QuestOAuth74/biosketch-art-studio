import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TEMPLATES, Template } from "@/lib/templates";
import { useBuiltInTemplates } from "@/hooks/useBuiltInTemplates";
import { TemplateCard } from "./TemplateCard";
import { Search, Sparkles, FileText } from "lucide-react";
import { toast } from "sonner";

interface TemplatesGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: Template) => void;
  onBlankCanvas: () => void;
}

export const TemplatesGallery = ({
  open,
  onOpenChange,
  onSelectTemplate,
  onBlankCanvas,
}: TemplatesGalleryProps) => {
  const { templates: dbTemplates } = useBuiltInTemplates();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filteredTemplates = useMemo(() => {
    let filtered = dbTemplates;

    // Filter by category
    if (activeCategory !== "all") {
      filtered = filtered.filter((t) => t.category === activeCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [activeCategory, searchQuery]);

  const handleTemplateSelect = (template: Template) => {
    onSelectTemplate(template);
    onOpenChange(false);
    toast.success(`Template "${template.name}" loaded!`);
  };

  const handleBlankCanvas = () => {
    onBlankCanvas();
    onOpenChange(false);
  };

  const getCategoryCount = (category: string) => {
    if (category === "all") return dbTemplates.length;
    return dbTemplates.filter((t) => t.category === category).length;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <DialogTitle className="text-2xl">Choose a Template</DialogTitle>
          </div>
          <DialogDescription>
            Get started quickly with a pre-designed template or start from scratch
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Tabs
          value={activeCategory}
          onValueChange={setActiveCategory}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="px-6 pt-2">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="all" className="flex items-center gap-1.5">
                All
                <span className="text-xs text-muted-foreground">
                  ({getCategoryCount("all")})
                </span>
              </TabsTrigger>
              <TabsTrigger value="scientific" className="flex items-center gap-1.5">
                Scientific
                <span className="text-xs text-muted-foreground">
                  ({getCategoryCount("scientific")})
                </span>
              </TabsTrigger>
              <TabsTrigger value="flowchart" className="flex items-center gap-1.5">
                Flowcharts
                <span className="text-xs text-muted-foreground">
                  ({getCategoryCount("flowchart")})
                </span>
              </TabsTrigger>
              <TabsTrigger value="business" className="flex items-center gap-1.5">
                Business
                <span className="text-xs text-muted-foreground">
                  ({getCategoryCount("business")})
                </span>
              </TabsTrigger>
              <TabsTrigger value="educational" className="flex items-center gap-1.5">
                Educational
                <span className="text-xs text-muted-foreground">
                  ({getCategoryCount("educational")})
                </span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={activeCategory} className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-[450px] px-6">
              {filteredTemplates.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
                  {filteredTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onClick={() => handleTemplateSelect(template)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[400px] text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No templates found</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Try adjusting your search or category
                  </p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter className="px-6 py-4 border-t bg-muted/30">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleBlankCanvas} className="gap-2">
            <FileText className="h-4 w-4" />
            Start with Blank Canvas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
