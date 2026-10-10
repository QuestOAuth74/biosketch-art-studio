import { Button } from "@/components/ui/button";
import { Facebook, Twitter, Linkedin, Mail, Link as LinkIcon, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ShareButtonsProps {
  url: string;
  title: string;
  compact?: boolean;
}

export const ShareButtons = ({ url, title, compact = false }: ShareButtonsProps) => {
  const { toast } = useToast();

  const shareLinks = {
    twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    email: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`,
  };

  const copyLink = () => {
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied!",
      description: "Post link copied to clipboard",
    });
  };

  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <a href={shareLinks.twitter} target="_blank" rel="noopener noreferrer" className="flex items-center cursor-pointer">
              <Twitter className="h-4 w-4 mr-2" />
              Twitter
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={shareLinks.facebook} target="_blank" rel="noopener noreferrer" className="flex items-center cursor-pointer">
              <Facebook className="h-4 w-4 mr-2" />
              Facebook
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={shareLinks.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center cursor-pointer">
              <Linkedin className="h-4 w-4 mr-2" />
              LinkedIn
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={shareLinks.email} className="flex items-center cursor-pointer">
              <Mail className="h-4 w-4 mr-2" />
              Email
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={copyLink} className="cursor-pointer">
            <LinkIcon className="h-4 w-4 mr-2" />
            Copy Link
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        asChild
        className="border-border/50 hover:bg-muted/50"
      >
        <a href={shareLinks.twitter} target="_blank" rel="noopener noreferrer">
          <Twitter className="h-4 w-4 mr-2" />
          Twitter
        </a>
      </Button>
      <Button
        variant="outline"
        size="sm"
        asChild
        className="border-border/50 hover:bg-muted/50"
      >
        <a href={shareLinks.facebook} target="_blank" rel="noopener noreferrer">
          <Facebook className="h-4 w-4 mr-2" />
          Facebook
        </a>
      </Button>
      <Button
        variant="outline"
        size="sm"
        asChild
        className="border-border/50 hover:bg-muted/50"
      >
        <a href={shareLinks.linkedin} target="_blank" rel="noopener noreferrer">
          <Linkedin className="h-4 w-4 mr-2" />
          LinkedIn
        </a>
      </Button>
      <Button
        variant="outline"
        size="sm"
        asChild
        className="border-border/50 hover:bg-muted/50"
      >
        <a href={shareLinks.email}>
          <Mail className="h-4 w-4 mr-2" />
          Email
        </a>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={copyLink}
        className="border-border/50 hover:bg-muted/50"
      >
        <LinkIcon className="h-4 w-4 mr-2" />
        Copy Link
      </Button>
    </div>
  );
};
