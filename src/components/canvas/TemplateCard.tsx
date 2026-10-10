import { Card } from "@/components/ui/card";
import { Template } from "@/lib/templates";
import { FileText } from "lucide-react";

interface TemplateCardProps {
  template: Template;
  onClick: () => void;
}

export const TemplateCard = ({ template, onClick }: TemplateCardProps) => {
  return (
    <Card 
      className="group cursor-pointer overflow-hidden transition-all hover:shadow-lg hover:scale-105 border-2 hover:border-primary"
      onClick={onClick}
    >
      <div className="aspect-[3/2] relative bg-muted/30 flex items-center justify-center overflow-hidden">
        {template.thumbnail ? (
          <img 
            src={template.thumbnail} 
            alt={template.name}
            className="w-full h-full object-contain p-2"
          />
        ) : (
          <FileText className="h-12 w-12 text-muted-foreground/50" />
        )}
        <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-sm font-medium px-3 py-1.5 rounded-full bg-background/90 text-foreground">
            Use Template
          </span>
        </div>
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-sm mb-1 line-clamp-1">{template.name}</h3>
        <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
      </div>
    </Card>
  );
};
