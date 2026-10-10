import { CanvasEditorTestIds } from '@/lib/test-ids';
import type { PresenceUser } from '@/hooks/usePresence';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface PresenceAvatarsProps {
  users: PresenceUser[];
}

const MAX_SHOWN = 5;

export function PresenceAvatars({ users }: PresenceAvatarsProps) {
  if (users.length === 0) return null;

  const shown = users.slice(0, MAX_SHOWN);
  const extra = users.length - MAX_SHOWN;

  return (
    <TooltipProvider>
      <div
        className="flex items-center -space-x-2"
        data-testid={CanvasEditorTestIds.PRESENCE_AVATARS}
      >
        {shown.map((u) => (
          <Tooltip key={u.userId}>
            <TooltipTrigger asChild>
              <div
                className="relative"
                data-testid={CanvasEditorTestIds.PRESENCE_AVATAR}
                style={{ zIndex: 1 }}
              >
                <Avatar
                  className="h-8 w-8 border-2 cursor-default"
                  style={{ borderColor: u.color }}
                >
                  {u.avatarUrl && <AvatarImage src={u.avatarUrl} />}
                  <AvatarFallback
                    className="text-xs font-semibold text-white"
                    style={{ backgroundColor: u.color }}
                  >
                    {u.displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">{u.displayName}</p>
            </TooltipContent>
          </Tooltip>
        ))}

        {extra > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted border-2 border-background text-xs font-medium text-muted-foreground cursor-default">
                +{extra}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">{extra} more user{extra !== 1 ? 's' : ''}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
