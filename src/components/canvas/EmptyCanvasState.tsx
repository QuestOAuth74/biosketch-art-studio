import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Beaker, 
  GitBranch, 
  Calendar, 
  Upload, 
  PlayCircle,
  Sparkles,
  LayoutTemplate,
  FileEdit
} from "lucide-react";

interface EmptyCanvasStateProps {
  onOpenTemplates: () => void;
  onStartTutorial: () => void;
  onQuickStart: (type: 'scientific' | 'flowchart' | 'timeline') => void;
  onStartBlank: () => void;
}

export const EmptyCanvasState = ({
  onOpenTemplates,
  onStartTutorial,
  onQuickStart,
  onStartBlank
}: EmptyCanvasStateProps) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="w-full max-w-5xl px-8 pointer-events-auto">
        <Card className="border border-slate-200 bg-white shadow-xl">
          <CardContent className="p-6">
            {/* Header */}
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mb-3">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold mb-2 text-slate-900">
                What would you like to create today?
              </h2>
              <p className="text-sm text-slate-600">
                Start with a template or create from scratch
              </p>
            </div>

            {/* Quick Start Options */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <Button
                variant="ghost"
                className="h-auto py-3 px-3 flex flex-col items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all"
                onClick={() => onQuickStart('scientific')}
              >
                <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <Beaker className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-slate-900">Scientific</div>
                  <div className="text-xs text-slate-500">Cells & pathways</div>
                </div>
              </Button>

              <Button
                variant="ghost"
                className="h-auto py-3 px-3 flex flex-col items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all"
                onClick={() => onQuickStart('flowchart')}
              >
                <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
                  <GitBranch className="h-5 w-5 text-green-600" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-slate-900">Flowchart</div>
                  <div className="text-xs text-slate-500">Process flows</div>
                </div>
              </Button>

              <Button
                variant="ghost"
                className="h-auto py-3 px-3 flex flex-col items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all"
                onClick={() => onQuickStart('timeline')}
              >
                <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-purple-600" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-slate-900">Timeline</div>
                  <div className="text-xs text-slate-500">Schedules</div>
                </div>
              </Button>

              <Button
                variant="ghost"
                className="h-auto py-3 px-3 flex flex-col items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all"
                onClick={onStartBlank}
              >
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                  <FileEdit className="h-5 w-5 text-slate-600" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-slate-900">Blank</div>
                  <div className="text-xs text-slate-500">Start fresh</div>
                </div>
              </Button>
            </div>

            {/* Main Actions */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <Button 
                className="flex-1"
                onClick={onOpenTemplates}
              >
                <LayoutTemplate className="h-4 w-4 mr-2" />
                Browse Community Templates
              </Button>
              <Button 
                variant="outline"
                className="flex-1"
                onClick={onStartTutorial}
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                Watch Quick Tutorial
              </Button>
            </div>

            {/* Additional Help */}
            <div className="flex flex-col items-center gap-2 pt-4 border-t border-slate-200">
              <p className="text-xs text-slate-500 text-center">
                Need help getting started?
              </p>
              <div className="flex gap-3">
                <Button variant="outline" size="sm" asChild>
                  <a href="https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/public/blog-media/biosketch%20video.mp4" target="_blank" rel="noopener noreferrer">
                    <PlayCircle className="h-3.5 w-3.5 mr-1" />
                    Demo Video
                  </a>
                </Button>
                <Button variant="outline" size="sm" onClick={onStartTutorial}>
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  Tutorial
                </Button>
              </div>
            </div>

            {/* Keyboard Hint */}
            <div className="mt-4 p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-xs text-center text-slate-600">
                💡 <strong>Tip:</strong> Press <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-300 text-xs font-mono">Ctrl+K</kbd> for command palette
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
