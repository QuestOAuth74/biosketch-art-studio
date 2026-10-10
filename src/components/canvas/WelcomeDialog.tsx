import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, BookOpen, Pencil, LayoutTemplate } from "lucide-react";

const FEATURED_TEMPLATES = [
  {
    id: "CELL_SIGNALING",
    name: "Cell Signaling",
    thumbnail: "/placeholder.svg",
    description: "Start with a basic cell signaling pathway"
  },
  {
    id: "WESTERN_BLOT",
    name: "Western Blot",
    thumbnail: "/placeholder.svg",
    description: "Create a western blot result figure"
  },
  {
    id: "FLOWCHART",
    name: "Experimental Flow",
    thumbnail: "/placeholder.svg",
    description: "Design your experiment workflow"
  }
];

interface WelcomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartWithTemplate: () => void;
  onStartTutorial: () => void;
  onStartBlank: () => void;
  onSkipTutorial: () => void;
}

export const WelcomeDialog = ({
  open,
  onOpenChange,
  onStartWithTemplate,
  onStartTutorial,
  onStartBlank,
  onSkipTutorial
}: WelcomeDialogProps) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const handleChoice = (choice: 'template' | 'tutorial' | 'blank') => {
    localStorage.setItem('canvas_welcome_completed', 'true');
    localStorage.setItem('canvas_first_choice', choice);
    
    if (choice === 'template') {
      onStartWithTemplate();
    } else if (choice === 'tutorial') {
      onStartTutorial();
    } else {
      onStartBlank();
    }
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto border border-slate-200 bg-white shadow-xl">
        <DialogHeader>
          <div className="flex items-center gap-2 justify-center mb-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <DialogTitle className="text-2xl font-semibold text-slate-900">Welcome to BioSketch Canvas!</DialogTitle>
          </div>
          <DialogDescription className="text-center text-base text-slate-600">
            Choose how you'd like to start creating your first scientific figure
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {/* Option 1: Start with Template */}
          <Card 
            className={`cursor-pointer transition-all duration-200 hover:shadow-lg border border-slate-200 bg-white ${
              selectedOption === 'template' ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setSelectedOption('template')}
          >
            <CardContent className="p-6 flex flex-col items-center text-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <LayoutTemplate className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2 text-slate-900">Start with a Template</h3>
                <p className="text-sm text-slate-600">
                  Choose from ready-made templates and customize them to your needs
                </p>
              </div>
              <Button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleChoice('template');
                }}
                className="w-full"
              >
                Browse Templates
              </Button>
            </CardContent>
          </Card>

          {/* Option 2: Interactive Tutorial */}
          <Card 
            className={`cursor-pointer transition-all duration-200 hover:shadow-lg border border-slate-200 bg-white ${
              selectedOption === 'tutorial' ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setSelectedOption('tutorial')}
          >
            <CardContent className="p-6 flex flex-col items-center text-center gap-4">
              <div className="h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center">
                <BookOpen className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2 text-slate-900">Try Interactive Tutorial</h3>
                <p className="text-sm text-slate-600">
                  Learn by doing with a guided 90-second hands-on walkthrough
                </p>
              </div>
              <Button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleChoice('tutorial');
                }}
                variant="outline"
                className="w-full"
              >
                Start Tutorial
              </Button>
            </CardContent>
          </Card>

          {/* Option 3: Start from Scratch */}
          <Card 
            className={`cursor-pointer transition-all duration-200 hover:shadow-lg border border-slate-200 bg-white ${
              selectedOption === 'blank' ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setSelectedOption('blank')}
          >
            <CardContent className="p-6 flex flex-col items-center text-center gap-4">
              <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center">
                <Pencil className="h-8 w-8 text-slate-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2 text-slate-900">Start from Scratch</h3>
                <p className="text-sm text-slate-600">
                  Jump right in with a blank canvas for experienced users
                </p>
              </div>
              <Button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleChoice('blank');
                }}
                variant="outline"
                className="w-full"
              >
                Blank Canvas
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Featured Templates Preview */}
        <div className="mt-6 pt-6 border-t border-slate-200">
          <h4 className="text-sm font-medium mb-3 text-center text-slate-700">
            Popular templates to get you started:
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {FEATURED_TEMPLATES.map((template) => (
              <div 
                key={template.id}
                className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-slate-50 transition-all duration-200 cursor-pointer border border-transparent hover:border-slate-200"
                onClick={() => handleChoice('template')}
              >
                <div className="h-16 w-full bg-slate-50 rounded flex items-center justify-center border border-slate-200">
                  <LayoutTemplate className="h-8 w-8 text-slate-400" />
                </div>
                <span className="text-xs font-medium text-center text-slate-700">{template.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col items-center gap-2">
          <p className="text-xs text-center text-slate-500">
            You can always access templates and tutorials later from the menu
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onSkipTutorial();
                onOpenChange(false);
              }}
              className="text-xs"
            >
              Skip & Start with Guide
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                localStorage.setItem('canvas_welcome_completed', 'true');
                onOpenChange(false);
              }}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Dismiss
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
