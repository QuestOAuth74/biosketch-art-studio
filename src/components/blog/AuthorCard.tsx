import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Author {
  id: string;
  full_name?: string;
  avatar_url?: string;
  email?: string;
}

interface AuthorCardProps {
  author: Author;
}

export const AuthorCard = ({ author }: AuthorCardProps) => {
  return (
    <div className="rounded-xl bg-muted/60 border border-border/50 p-6">
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-4">Written by</p>
      <div className="flex items-center gap-4">
        <Avatar className="h-14 w-14 ring-2 ring-background shadow-sm">
          <AvatarImage src={author.avatar_url} alt={author.full_name || 'Author'} />
          <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
            {author.full_name?.charAt(0).toUpperCase() || 'A'}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold text-lg text-foreground">{author.full_name || 'Anonymous'}</p>
          <p className="text-sm text-muted-foreground">Author</p>
        </div>
      </div>
    </div>
  );
};
