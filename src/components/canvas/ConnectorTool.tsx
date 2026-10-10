import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowCircleRight,
  ArrowRightIcon,
  ArrowsLeftRightIcon,
  FlowArrowIcon,
  GitCommit,
  LineSegmentIcon,
  PathIcon,
  TreeStructure,
} from "@phosphor-icons/react";

interface ConnectorToolProps {
  onConnectorSelect: (connectorType: string) => void;
  activeTool?: string;
}

export const ConnectorTool = ({
  onConnectorSelect,
  activeTool,
}: ConnectorToolProps) => {
  const isConnectorActive =
    (activeTool?.startsWith("connector-") || activeTool?.startsWith("line-")) &&
    !activeTool?.startsWith("straight-line");

  const toolButtonBase =
    "w-8 h-8 flex-shrink-0 rounded-md transition-all duration-150 hover:scale-105";
  const toolButtonActive = `${toolButtonBase} bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30`;
  const toolButtonInactive = `${toolButtonBase} text-muted-foreground hover:text-foreground hover:bg-blue-200/60 hover:shadow-sm`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={isConnectorActive ? toolButtonActive : toolButtonInactive}
        >
          <FlowArrowIcon
            style={{ width: 18, height: 18 }}
            weight={isConnectorActive ? "duotone" : "bold"}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        className="w-56 bg-card z-50"
      >
        <DropdownMenuLabel>Smart Connectors</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => onConnectorSelect("connector-straight")}
          >
            <ArrowsLeftRightIcon
              style={{ width: 18, height: 18 }}
              weight="regular"
              className="mr-2"
            />
            <span>Straight Connector</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onConnectorSelect("connector-curved")}
          >
            <PathIcon
              style={{ width: 18, height: 18 }}
              weight="regular"
              className="mr-2"
            />
            <span>Curved Connector</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onConnectorSelect("connector-orthogonal")}
          >
            <TreeStructure
              style={{ width: 18, height: 18 }}
              weight="regular"
              className="mr-2"
            />
            <span>Orthogonal Connector</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Line Styles</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onConnectorSelect("line-arrow")}>
            <ArrowRightIcon
              style={{ width: 18, height: 18 }}
              weight="regular"
              className="mr-2"
            />
            <span>Arrow Line →</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onConnectorSelect("line-double-arrow")}
          >
            <ArrowsLeftRightIcon
              style={{ width: 18, height: 18 }}
              weight="regular"
              className="mr-2"
            />
            <span>Double Arrow ↔</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onConnectorSelect("line-plain")}>
            <LineSegmentIcon
              style={{ width: 18, height: 18 }}
              weight="regular"
              className="mr-2"
            />
            <span>Plain Line</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onConnectorSelect("line-circle-arrow")}
          >
            <ArrowCircleRight
              style={{ width: 18, height: 18 }}
              weight="regular"
              className="mr-2"
            />
            <span>Circle Arrow</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onConnectorSelect("line-diamond")}>
            <GitCommit
              style={{ width: 18, height: 18 }}
              weight="regular"
              className="mr-2"
            />
            <span>Diamond Line (UML)</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
