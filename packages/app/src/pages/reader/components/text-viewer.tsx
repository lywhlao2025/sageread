import { useEffect, useState } from "react";

interface TextViewerProps {
  file: File;
}

const TextViewer = ({ file }: TextViewerProps) => {
  const [content, setContent] = useState("");
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadError(false);

    const load = async () => {
      try {
        const text = await file.text();
        if (active) setContent(text);
      } catch (error) {
        console.error("Failed to read txt file:", error);
        if (active) setLoadError(true);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [file]);

  if (loadError) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
        无法读取文本内容
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto px-6 py-4 text-[15px] text-neutral-800 leading-7 dark:text-neutral-100">
      <pre className="whitespace-pre-wrap">{content}</pre>
    </div>
  );
};

export default TextViewer;
