import { useState } from "react";
import { NotepadContent } from "./notepad-content";
import { NotepadHeader } from "./notepad-header";
import { useReaderStore } from "@/pages/reader/components/reader-provider";

export type NotepadTab = "notes" | "annotations";

interface NotepadContainerProps {
  bookId: string;
}

export const NotepadContainer = ({ bookId }: NotepadContainerProps) => {
  const [activeTab, setActiveTab] = useState<NotepadTab>("notes");
  const book = useReaderStore((state) => state.bookData?.book);

  return (
    <div className="flex h-full flex-col bg-background">
      <NotepadHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        bookId={bookId}
        bookTitle={book?.title}
        bookAuthor={book?.author}
      />
      <div className="flex-1 overflow-hidden">
        <NotepadContent activeTab={activeTab} bookId={bookId} />
      </div>
    </div>
  );
};
