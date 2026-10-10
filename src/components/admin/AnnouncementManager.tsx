import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, Send, ShieldAlert } from "lucide-react";

interface AnnouncementTemplate {
  id: string;
  name: string;
  subject: string;
  message: string;
  icon: string;
}

const ANNOUNCEMENT_TEMPLATES: AnnouncementTemplate[] = [
  {
    id: "new-feature",
    name: "New Feature",
    subject: "Exciting New Feature: [Feature Name]",
    message: "We're thrilled to announce a new feature that will enhance your BioSketch experience! [Feature Name] allows you to [describe benefit]. Try it out today in your canvas workspace. We'd love to hear your feedback!",
    icon: "✨"
  },
  {
    id: "maintenance",
    name: "Maintenance Notice",
    subject: "Scheduled Maintenance - [Date]",
    message: "We'll be performing scheduled maintenance on [Date] at [Time]. During this time, BioSketch may be temporarily unavailable for approximately [Duration]. We appreciate your patience as we work to improve our service.",
    icon: "🔧"
  },
  {
    id: "update",
    name: "Platform Update",
    subject: "Platform Update: Improvements & Bug Fixes",
    message: "We've just released an update to BioSketch with several improvements and bug fixes. Highlights include: [list key improvements]. Your feedback helps us make BioSketch better - keep it coming!",
    icon: "🚀"
  },
  {
    id: "performance",
    name: "Performance Improvement",
    subject: "BioSketch Just Got Faster!",
    message: "Great news! We've optimized BioSketch performance, making the canvas smoother and more responsive. You should notice faster loading times and improved rendering, especially for complex diagrams.",
    icon: "⚡"
  },
  {
    id: "community",
    name: "Community Highlight",
    subject: "Amazing Work from Our Community",
    message: "We're constantly inspired by what our community creates! This week, we're highlighting exceptional projects in the Community gallery. Check them out for inspiration and don't forget to share your own work!",
    icon: "🌟"
  },
  {
    id: "tutorial",
    name: "Tutorial/Tip",
    subject: "Pro Tip: [Feature/Technique]",
    message: "Did you know you can [describe technique]? This feature helps you [benefit] and saves time. Watch our quick tutorial or jump into your canvas to try it yourself!",
    icon: "💡"
  }
];

export const AnnouncementManager = () => {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [senderName, setSenderName] = useState("BioSketch Team");
  const [targetAudience, setTargetAudience] = useState<"all" | "premium" | "new">("all");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const handleTemplateSelect = (templateId: string) => {
    if (!templateId) {
      setSelectedTemplate("");
      return;
    }

    const template = ANNOUNCEMENT_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);
      setSubject(template.subject);
      setMessage(template.message);
      toast.success(`Applied "${template.name}" template`);
    }
  };

  const handleSendAnnouncement = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Please fill in both subject and message");
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-announcement", {
        body: {
          subject: subject.trim(),
          message: message.trim(),
          senderName: senderName.trim(),
          targetAudience,
        },
      });

      if (error) throw error;

      toast.success(`Announcement sent to ${data.count} users`);
      setSubject("");
      setMessage("");
      setSelectedTemplate("");
      setTargetAudience("all");
    } catch (error: any) {
      console.error("Error sending announcement:", error);
      
      // Check for admin access denied errors (400 or 403)
      const errorMessage = error.message || "";
      const isAccessDenied = 
        errorMessage.includes("Admin access required") ||
        errorMessage.includes("403") ||
        error.context?.status === 400 ||
        error.context?.status === 403;

      if (isAccessDenied) {
        setAccessDenied(true);
      } else {
        toast.error(errorMessage || "Failed to send announcement");
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <CardTitle>Send Announcement</CardTitle>
        </div>
        <CardDescription>
          Send in-app notifications to users. Messages appear in their notification bell.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {accessDenied ? (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Admin Access Required</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                You need the 'admin' role to send announcements. Your account currently doesn't have this permission.
              </p>
              <p className="text-sm">
                To grant admin access, add a record to the <code className="px-1.5 py-0.5 bg-muted rounded text-xs">user_roles</code> table:
              </p>
              <ol className="text-sm space-y-1 ml-4 list-decimal">
                <li>Go to Supabase Dashboard → SQL Editor</li>
                <li>Run: <code className="px-1.5 py-0.5 bg-muted rounded text-xs">INSERT INTO user_roles (user_id, role) VALUES ('your-user-id', 'admin')</code></li>
                <li>Log out and log back in to refresh your session</li>
              </ol>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAccessDenied(false)}
                className="mt-2"
              >
                Try Again
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <>
        <div className="space-y-2">
          <Label htmlFor="template">Quick Templates</Label>
          <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a template or write custom message" />
            </SelectTrigger>
            <SelectContent>
              {ANNOUNCEMENT_TEMPLATES.map(template => (
                <SelectItem key={template.id} value={template.id}>
                  <div className="flex items-center gap-2">
                    <span>{template.icon}</span>
                    <span>{template.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Select a template to auto-fill subject and message, then customize as needed
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sender">Sender Name</Label>
          <Input
            id="sender"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder="BioSketch Team"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="New Feature: Real-time Collaboration"
            maxLength={100}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="message">Message</Label>
          <Textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="We're excited to announce real-time collaboration features..."
            rows={5}
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground text-right">
            {message.length}/500
          </p>
        </div>

        <div className="space-y-2">
          <Label>Target Audience</Label>
          <RadioGroup value={targetAudience} onValueChange={(value: any) => setTargetAudience(value)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="all" />
              <Label htmlFor="all" className="font-normal cursor-pointer">
                All users
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="premium" id="premium" />
              <Label htmlFor="premium" className="font-normal cursor-pointer">
                Premium users (3+ approved projects)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="new" id="new" />
              <Label htmlFor="new" className="font-normal cursor-pointer">
                New users (joined in last 7 days)
              </Label>
            </div>
          </RadioGroup>
        </div>

          <Button
            onClick={handleSendAnnouncement}
            disabled={isSending || !subject.trim() || !message.trim()}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            {isSending ? "Sending..." : "Send Announcement"}
          </Button>
        </>
        )}
      </CardContent>
    </Card>
  );
};
