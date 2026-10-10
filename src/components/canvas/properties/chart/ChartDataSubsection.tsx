import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChartTableData } from "@/lib/chartTool";
import { parseCSV } from "@/lib/csvParser";
import { ChartTestIds } from "@/lib/test-ids";
import {
  ArrowRightIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface ChartDataSubsectionProps {
  config: { data: ChartTableData };
  onUpdate: (data: ChartTableData) => void;
}

export const ChartDataSubsection = ({
  config,
  onUpdate,
}: ChartDataSubsectionProps) => {
  const [localData, setLocalData] = useState(config.data);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Update local data when config changes
  useEffect(() => {
    setLocalData(config.data);
  }, [config.data]);

  // Debounced update to parent
  const debouncedUpdate = useCallback(
    (newData: ChartTableData) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        onUpdate(newData);
      }, 500);
    },
    [onUpdate],
  );

  const handleCellChange = (
    rowIndex: number,
    colIndex: number,
    value: string,
  ) => {
    const newData = { ...localData };
    if (rowIndex === -1) {
      // Header cell
      newData.headers[colIndex] = value;
    } else {
      // Data cell
      newData.rows[rowIndex][colIndex] = value;
    }
    setLocalData(newData);
    debouncedUpdate(newData);
  };

  const handleCellFocus = (
    e: React.FocusEvent<HTMLInputElement>
  ) => {
    // Select all content when cell is focused
    e.target.select();
  };

  const handleCellBlur = (
    rowIndex: number,
    colIndex: number,
    value: string
  ) => {
    // Set to "0" if empty
    if (rowIndex !== -1 && value.trim() === "") {
      const newData = { ...localData };
      newData.rows[rowIndex][colIndex] = "0";
      setLocalData(newData);
      onUpdate(newData);
    }
  };

  const handleAddRow = () => {
    const newData = { ...localData };
    const newRow = new Array(localData.headers.length).fill("0");
    newData.rows.push(newRow);
    setLocalData(newData);
    onUpdate(newData);
  };

  const handleRemoveRow = (rowIndex: number) => {
    if (localData.rows.length <= 1) {
      toast.error("Chart must have at least one data row");
      return;
    }

    const newData = { ...localData };
    newData.rows.splice(rowIndex, 1);
    setLocalData(newData);
    onUpdate(newData);
  };

  const handleAddColumn = () => {
    const newData = { ...localData };
    newData.headers.push(`Column ${localData.headers.length + 1}`);
    newData.rows.forEach((row) => row.push("0"));
    setLocalData(newData);
    onUpdate(newData);
  };

  const handleRemoveColumn = (colIndex: number) => {
    if (localData.headers.length <= 2) {
      toast.error("Chart must have at least 2 columns (X and Y)");
      return;
    }

    const newData = { ...localData };
    newData.headers.splice(colIndex, 1);
    newData.rows.forEach((row) => row.splice(colIndex, 1));
    setLocalData(newData);
    onUpdate(newData);
  };


  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const csvContent = event.target?.result as string;
      try {
        const parsed = parseCSV(csvContent);
        setLocalData(parsed);
        onUpdate(parsed);
        toast.success("CSV file loaded successfully");
      } catch (error) {
        console.error("Error parsing CSV:", error);
        toast.error("Failed to parse CSV file");
      }
    };
    reader.readAsText(file);

    // Reset input
    e.target.value = "";
  };

  const handlePasteCSV = () => {
    try {
      const parsed = parseCSV(csvText);
      setLocalData(parsed);
      onUpdate(parsed);
      setCsvDialogOpen(false);
      setCsvText("");
      toast.success("CSV data pasted successfully");
    } catch (error) {
      console.error("Error parsing CSV:", error);
      toast.error("Failed to parse CSV data");
    }
  };

  if (!localData) return null;

  return (
    <div className="space-y-3">
      <Label className="text-xs font-semibold">Data</Label>

      {/* Edit Data Button */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      >
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs"
            data-testid={ChartTestIds.EDIT_DATA_BUTTON}
          >
            <PencilIcon className="h-3.5 w-3.5 mr-2" />
            Edit chart data
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col" data-testid={ChartTestIds.DATA_DIALOG}>
          <DialogHeader>
            <DialogTitle>Edit Chart Data</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto space-y-4">
            {/* CSV Import Options and Back Button */}
            <div className="flex gap-2 justify-between items-center">
              <div className="flex gap-2">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload-dialog"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    document.getElementById("csv-upload-dialog")?.click()
                  }
                  className="h-8 text-xs"
                  data-testid={ChartTestIds.UPLOAD_CSV_BUTTON}
                >
                  <UploadIcon className="h-3.5 w-3.5 mr-2" />
                  Upload CSV
                </Button>

                <Dialog
                  open={csvDialogOpen}
                  onOpenChange={setCsvDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      data-testid={ChartTestIds.PASTE_CSV_BUTTON}
                    >
                      Paste CSV
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Paste CSV Data</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <Textarea
                        value={csvText}
                        onChange={(e) => setCsvText(e.target.value)}
                        placeholder="Paste CSV data here..."
                        rows={10}
                        className="text-xs font-mono"
                      />
                      <Button
                        onClick={handlePasteCSV}
                        className="w-full"
                      >
                        Import Data
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

              </div>

              {/* Back to Chart Button */}
              <Button
                onClick={() => setEditDialogOpen(false)}
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                data-testid={ChartTestIds.DATA_DIALOG_CLOSE}
              >
                Back to chart
                <ArrowRightIcon className="h-3.5 w-3.5 ml-2" />
              </Button>
            </div>

            {/* Editable Table */}
            <div className="border border-slate-200 rounded-md overflow-hidden">
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table
                  className="w-full text-xs"
                  style={{ borderCollapse: "collapse" }}
                >
                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr>
                      <th className="p-0 text-left w-8 bg-slate-50">
                        <div
                          className="p-1"
                          style={{
                            minHeight: "100%",
                          }}
                        ></div>
                      </th>
                      {localData.headers.map((header, colIndex) => {
                        return (
                          <th
                            key={colIndex}
                            className="p-0"
                            style={{
                              backgroundColor: '#f8fafc',
                              minWidth: '120px'
                            }}
                          >
                            <div
                              className="p-1 flex items-center gap-1"
                              style={
                                colIndex === 0
                                  ? {
                                      borderLeft: "1px solid #cbd5e1",
                                      borderRight: "1px solid #cbd5e1",
                                    }
                                  : {
                                      borderRight: "1px solid #cbd5e1",
                                    }
                              }
                            >
                              <Input
                                value={header}
                                onChange={(e) =>
                                  handleCellChange(-1, colIndex, e.target.value)
                                }
                                onFocus={handleCellFocus}
                                className="h-7 text-xs font-medium text-center border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                style={{
                                  backgroundColor: '#f8fafc'
                                }}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveColumn(colIndex)}
                                className="h-6 w-6 p-0 hover:bg-red-100 flex-shrink-0 group"
                                disabled={localData.headers.length <= 2}
                              >
                                <TrashIcon className="h-3 w-3 text-slate-400 group-hover:text-red-600 transition-colors" />
                              </Button>
                            </div>
                          </th>
                        );
                      })}
                      <th className="p-0 w-8 bg-slate-50">
                        <div className="p-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleAddColumn}
                            className="h-6 w-6 p-0 hover:bg-slate-200"
                          >
                            <PlusIcon className="h-3 w-3" />
                          </Button>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {localData.rows.map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className="bg-slate-50"
                      >
                        <td
                          className="p-1 text-center text-slate-400"
                          style={{
                            borderRight: "1px solid #cbd5e1",
                            borderBottom: "1px solid #cbd5e1",
                            borderTop: "1px solid #cbd5e1",
                          }}
                        >
                          {rowIndex + 1}
                        </td>
                        {row.map((cell, colIndex) => {
                          return (
                            <td
                              key={colIndex}
                              className="p-1"
                              style={{
                                borderTop: "1px solid #cbd5e1",
                                borderRight: "1px solid #cbd5e1",
                                borderBottom: "1px solid #cbd5e1",
                                backgroundColor: 'transparent',
                                minWidth: '120px'
                              }}
                            >
                              <Input
                                value={cell}
                                onChange={(e) =>
                                  handleCellChange(
                                    rowIndex,
                                    colIndex,
                                    e.target.value,
                                  )
                                }
                                onFocus={handleCellFocus}
                                onBlur={(e) => handleCellBlur(rowIndex, colIndex, e.target.value)}
                                className="h-7 text-xs text-center border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                style={{
                                  backgroundColor: '#f8fafc'
                                }}
                                data-testid={`${ChartTestIds.DATA_CELL}-${rowIndex}-${colIndex}`}
                              />
                            </td>
                          );
                        })}
                        <td
                          className="p-1"
                          style={
                            rowIndex === 0
                              ? {
                                  borderBottom: "1px solid #cbd5e1",
                                  borderTop: "1px solid #cbd5e1",
                                }
                              : {
                                  borderBottom: "1px solid #cbd5e1",
                                }
                          }
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveRow(rowIndex)}
                            className="h-6 w-6 p-0 hover:bg-red-100 group"
                            disabled={localData.rows.length <= 1}
                          >
                            <TrashIcon className="h-3 w-3 text-slate-400 group-hover:text-red-600 transition-colors" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr
                      className="bg-slate-100 hover:bg-slate-200 cursor-pointer transition-colors"
                      onClick={handleAddRow}
                    >
                      <td
                        colSpan={localData.headers.length + 2}
                        className="p-2 text-center"
                      >
                        <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-600">
                          <PlusIcon className="h-3.5 w-3.5" />
                          <span>Add Row</span>
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
