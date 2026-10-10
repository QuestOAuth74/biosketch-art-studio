import { Users, Shield } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import type { SidebarMember } from '@/hooks/useSocialSidebarData';

interface SidebarMembersSectionProps {
  members: SidebarMember[];
  admins: SidebarMember[];
  loading: boolean;
}

function MemberRow({ member }: { member: SidebarMember }) {
  const initials = member.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const roleVariant = member.role === 'owner' ? 'default' : member.role === 'admin' ? 'secondary' : 'outline';

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="relative">
        <Avatar className="h-8 w-8">
          <AvatarImage src={member.avatarUrl ?? undefined} alt={member.fullName} />
          <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
        </Avatar>
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{member.fullName}</p>
      </div>
      <Badge variant={roleVariant} className="text-[10px] capitalize shrink-0">
        {member.role}
      </Badge>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

export function SidebarMembersSection({ members, admins, loading }: SidebarMembersSectionProps) {
  return (
    <div className="space-y-4">
      {/* Admins */}
      <Card className="border-border/50">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Admins
            {!loading && <Badge variant="secondary" className="text-[10px] ml-auto">{admins.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          {loading ? (
            <LoadingSkeleton />
          ) : admins.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">No admins found</p>
          ) : (
            <ScrollArea className={admins.length > 4 ? 'max-h-[180px]' : undefined}>
              <div className="space-y-1">
                {admins.map((admin) => (
                  <MemberRow key={admin.userId} member={admin} />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* All Members */}
      <Card className="border-border/50">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Members
            {!loading && <Badge variant="secondary" className="text-[10px] ml-auto">{members.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          {loading ? (
            <LoadingSkeleton />
          ) : members.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">No members yet</p>
          ) : (
            <ScrollArea className={members.length > 5 ? 'max-h-[240px]' : undefined}>
              <div className="space-y-1">
                {members.map((member) => (
                  <MemberRow key={member.userId} member={member} />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
