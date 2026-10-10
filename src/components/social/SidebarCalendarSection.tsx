import { CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';

interface SidebarCalendarSectionProps {
  activityDates: Date[];
  loading: boolean;
}

export function SidebarCalendarSection({ activityDates, loading }: SidebarCalendarSectionProps) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          Activity Calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-3 pt-0">
        {loading ? (
          <div className="flex justify-center py-4">
            <Skeleton className="h-[250px] w-full rounded-lg" />
          </div>
        ) : (
          <Calendar
            modifiers={{ activity: activityDates }}
            modifiersClassNames={{ activity: 'bg-primary/20 text-primary font-semibold rounded-md' }}
            className="w-full [&_table]:w-full [&_td]:p-0 [&_th]:p-0"
          />
        )}
      </CardContent>
    </Card>
  );
}
