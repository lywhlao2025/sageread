import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Highlighter, NotebookPen, Search } from "lucide-react";
import { useState } from "react";
import { ExportDialog } from "./export-dialog";
import type { NotepadTab } from "./notepad-container";

interface NotepadHeaderProps {
  activeTab: NotepadTab;
  onTabChange: (tab: NotepadTab) => void;
  bookId: string;
  bookTitle?: string;
  bookAuthor?: string;
}

export const NotepadHeader = ({ activeTab, onTabChange, bookId, bookTitle, bookAuthor }: NotepadHeaderProps) => {
  const [openExport, setOpenExport] = useState(false);
  return (
    <div className="h-10 border-neutral-200 bg-background pt-0 pb-10 dark:border-neutral-700">
      <div className="flex select-none items-center justify-between">
        <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as NotepadTab)} className="mb-1 flex">
          <TabsList className="h-9 rounded-full">
            <TabsTrigger className="h-7 rounded-full" value="notes">
              <NotebookPen className="mr-1 size-4" />
              <span>笔记</span>
            </TabsTrigger>
            <TabsTrigger className="h-7 rounded-full" value="annotations">
              <Highlighter className="mr-1 size-4" />
              <span>标注</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="z-40 size-7 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700"
            onClick={() => setOpenExport(true)}
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="z-40 size-7 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700"
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <ExportDialog
        open={openExport}
        onOpenChange={setOpenExport}
        bookId={bookId}
        bookTitle={bookTitle}
        bookAuthor={bookAuthor}
      />
    </div>
  );
};
