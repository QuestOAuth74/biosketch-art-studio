import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ChartConfig, ChartType, ErrorBarConfig, DEFAULT_DOSE_RESPONSE_CONFIG, DEFAULT_DOSE_RESPONSE_DATA } from "@/lib/chartTool";
import { ColorPickerSection } from "../ColorPickerSection";
import { useEffect } from "react";
import { ChartTestIds } from "@/lib/test-ids";

interface ChartTypeSubsectionProps {
  config: ChartConfig;
  onUpdate: (updates: Partial<ChartConfig>) => void;
  recentColors: string[];
  addToRecentColors: (color: string) => void;
}

export const ChartTypeSubsection = ({
  config,
  onUpdate,
  recentColors,
  addToRecentColors
}: ChartTypeSubsectionProps) => {
  const { type, data, columnMapping, errorBarConfig } = config;

  // Initialize error bar config with defaults if not present
  useEffect(() => {
    if (!data || !columnMapping) return;
    if (!errorBarConfig && type !== 'box' && type !== 'dose-response') {
      // Create default mapping: map each Y-axis column to nearest available error column
      const defaultMapping: { [key: number]: number } = {};
      const availableErrors = data.headers
        .map((header, index) => ({ header, index }))
        .filter(col =>
          col.index !== columnMapping.xAxis &&
          !columnMapping.yAxes.includes(col.index)
        );

      columnMapping.yAxes.forEach((yAxisCol, idx) => {
        // Map to the nearest error column (by index proximity)
        const nearestError = availableErrors.reduce((nearest, current) => {
          if (!nearest) return current;
          const currentDist = Math.abs(current.index - yAxisCol);
          const nearestDist = Math.abs(nearest.index - yAxisCol);
          return currentDist < nearestDist ? current : nearest;
        }, availableErrors[0]);

        if (nearestError) {
          defaultMapping[yAxisCol] = nearestError.index;
        }
      });

      // Initialize matchValueColor to true for all mapped columns
      const defaultMatchValueColor: { [key: number]: boolean } = {};
      Object.keys(defaultMapping).forEach(key => {
        defaultMatchValueColor[parseInt(key)] = true;
      });

      onUpdate({
        errorBarConfig: {
          enabled: false,
          mapping: defaultMapping,
          matchValueColor: defaultMatchValueColor,
          customColors: {}
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, errorBarConfig]);

  if (!data || !columnMapping) return null;

  // Get available error columns (all columns not assigned as X-axis or Y-axis)
  const availableErrorColumns = data.headers
    .map((header, index) => ({ header, index }))
    .filter(col =>
      col.index !== columnMapping.xAxis &&
      !columnMapping.yAxes.includes(col.index)
    );

  const handleTypeChange = (newType: ChartType) => {
    if (newType === 'dose-response' && type !== 'dose-response') {
      // Save current data/mapping/style before switching to dose-response
      onUpdate({
        type: newType,
        _savedConfig: {
          data: config.data,
          columnMapping: config.columnMapping,
          style: config.style,
        },
        data: DEFAULT_DOSE_RESPONSE_DATA,
        columnMapping: { xAxis: 0, yAxes: [1] },
        doseResponseConfig: config.doseResponseConfig || DEFAULT_DOSE_RESPONSE_CONFIG,
        style: {
          ...config.style,
          xAxisLabel: 'Concentration',
          yAxisLabel: 'Response (%)',
          title: 'Dose-Response Curve',
        },
      });
      return;
    }
    if (newType !== 'dose-response' && type === 'dose-response') {
      // Switching away from dose-response — restore saved config if available
      const saved = config._savedConfig;
      if (saved) {
        onUpdate({
          type: newType,
          data: saved.data,
          columnMapping: saved.columnMapping,
          style: saved.style,
          _savedConfig: undefined,
        });
        return;
      }
    }
    onUpdate({ type: newType });
  };

  const handleXAxisChange = (value: string) => {
    onUpdate({
      columnMapping: {
        ...columnMapping,
        xAxis: parseInt(value)
      }
    });
  };

  const handleYAxisToggle = (colIndex: number, checked: boolean) => {
    const newYAxes = checked
      ? [...columnMapping.yAxes, colIndex].sort((a, b) => a - b)
      : columnMapping.yAxes.filter(idx => idx !== colIndex);

    if (newYAxes.length === 0) {
      // Don't allow removing all Y axes
      return;
    }

    onUpdate({
      columnMapping: {
        ...columnMapping,
        yAxes: newYAxes
      }
    });
  };

  const handleErrorBarsToggle = (enabled: boolean) => {
    if (!errorBarConfig) return;

    onUpdate({
      errorBarConfig: {
        ...errorBarConfig,
        enabled
      }
    });
  };

  const handleErrorMappingChange = (dataCol: number, errorCol: string) => {
    if (!errorBarConfig) return;

    const newMapping = { ...errorBarConfig.mapping };
    const newMatchValueColor = { ...errorBarConfig.matchValueColor };

    if (errorCol === 'none') {
      delete newMapping[dataCol];
      delete newMatchValueColor[dataCol];
    } else {
      newMapping[dataCol] = parseInt(errorCol);
      // Default to matching value color when first assigning error bar
      if (!(dataCol in newMatchValueColor)) {
        newMatchValueColor[dataCol] = true;
      }
    }

    onUpdate({
      errorBarConfig: {
        ...errorBarConfig,
        mapping: newMapping,
        matchValueColor: newMatchValueColor
      }
    });
  };

  const handleMatchValueColorChange = (dataCol: number, checked: boolean) => {
    if (!errorBarConfig) return;

    const newMatchValueColor = { ...errorBarConfig.matchValueColor };
    newMatchValueColor[dataCol] = checked;

    onUpdate({
      errorBarConfig: {
        ...errorBarConfig,
        matchValueColor: newMatchValueColor
      }
    });
  };

  const handleCustomColorChange = (dataCol: number, color: string) => {
    if (!errorBarConfig) return;

    const newCustomColors = { ...errorBarConfig.customColors };
    newCustomColors[dataCol] = color;

    onUpdate({
      errorBarConfig: {
        ...errorBarConfig,
        customColors: newCustomColors
      }
    });
  };


  return (
    <div className="space-y-3">
      <div className="border-t border-slate-200 pt-3">
        <Label className="text-xs font-semibold">Chart Type & Mapping</Label>
      </div>

      {/* Chart Type Selector */}
      <div className="space-y-2">
        <Label className="text-xs">Chart Type</Label>
        <Select value={type} onValueChange={handleTypeChange}>
          <SelectTrigger className="h-8 text-xs" data-testid={ChartTestIds.CHART_TYPE_SELECT}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bar">Bar Chart</SelectItem>
            <SelectItem value="line">Line Chart</SelectItem>
            <SelectItem value="scatter">Scatter Plot</SelectItem>
            <SelectItem value="box">Box Plot</SelectItem>
            <SelectItem value="dose-response">Dose-Response Curve</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* X-Axis Column */}
      <div className="space-y-2">
        <Label className="text-xs">X-Axis Column</Label>
        <Select value={columnMapping.xAxis.toString()} onValueChange={handleXAxisChange}>
          <SelectTrigger className="h-8 text-xs" data-testid={ChartTestIds.X_AXIS_SELECT}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {data.headers.map((header, index) => (
              <SelectItem key={index} value={index.toString()}>
                {header}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Y-Axis Columns (Multi-Select) */}
      <div className="space-y-2">
        <Label className="text-xs">Y-Axis Columns (Series)</Label>
        <div className="border border-slate-200 rounded-md p-2 space-y-1 max-h-32 overflow-y-auto">
          {data.headers.map((header, index) => {
            if (index === columnMapping.xAxis) return null; // Don't show X-axis column

            return (
              <div key={index} className="flex items-center space-x-2">
                <Checkbox
                  id={`y-axis-${index}`}
                  checked={columnMapping.yAxes.includes(index)}
                  onCheckedChange={(checked) => handleYAxisToggle(index, checked as boolean)}
                  data-testid={`${ChartTestIds.Y_AXIS_CHECKBOX}-${index}`}
                />
                <label
                  htmlFor={`y-axis-${index}`}
                  className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {header}
                </label>
              </div>
            );
          })}
        </div>
      </div>

      {/* Error Bars (not for box plots or dose-response) */}
      {type !== 'box' && type !== 'dose-response' && errorBarConfig && (
        <>
          <div className="border-t border-slate-200 pt-3">
            <Label className="text-xs font-semibold">Error Bars</Label>
          </div>

          {/* Error Bars Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="error-bars-enabled"
              checked={errorBarConfig.enabled}
              onCheckedChange={handleErrorBarsToggle}
              data-testid={ChartTestIds.ERROR_BARS_CHECKBOX}
            />
            <label
              htmlFor="error-bars-enabled"
              className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Error bars
            </label>
          </div>

          {/* Error Bar Configuration */}
          {errorBarConfig.enabled && availableErrorColumns.length === 0 && (
            <div className="text-xs text-muted-foreground italic py-2">
              No available error bar columns
            </div>
          )}

          {errorBarConfig.enabled && availableErrorColumns.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-600">Error bars data columns</Label>
              <div className="space-y-3">
                {columnMapping.yAxes.map(yAxisIdx => {
                  const hasErrorBar = errorBarConfig.mapping[yAxisIdx] !== undefined;
                  const matchesValueColor = errorBarConfig.matchValueColor[yAxisIdx] ?? true;
                  const customColor = errorBarConfig.customColors[yAxisIdx] || '#000000';

                  return (
                    <div key={yAxisIdx} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs flex-1">{data.headers[yAxisIdx]}</Label>
                        <Select
                          value={errorBarConfig.mapping[yAxisIdx]?.toString() || 'none'}
                          onValueChange={(value) => handleErrorMappingChange(yAxisIdx, value)}
                        >
                          <SelectTrigger className="h-7 text-xs flex-1" data-testid={`${ChartTestIds.ERROR_BAR_SELECT}-${yAxisIdx}`}>
                            <SelectValue placeholder="No error bars" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No error bars</SelectItem>
                            {availableErrorColumns.map(({ header, index }) => (
                              <SelectItem key={index} value={index.toString()}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Color options - only show when error bar is selected */}
                      {hasErrorBar && (
                        <div className="ml-4 space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`match-color-${yAxisIdx}`}
                              checked={matchesValueColor}
                              onCheckedChange={(checked) => handleMatchValueColorChange(yAxisIdx, checked as boolean)}
                            />
                            <label
                              htmlFor={`match-color-${yAxisIdx}`}
                              className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              Match value color
                            </label>
                          </div>

                          {/* Color picker - only show when not matching value color */}
                          {!matchesValueColor && (
                            <ColorPickerSection
                              label="Error bar color"
                              value={customColor}
                              onChange={(color) => {
                                handleCustomColorChange(yAxisIdx, color);
                                addToRecentColors(color);
                              }}
                              recentColors={recentColors}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
