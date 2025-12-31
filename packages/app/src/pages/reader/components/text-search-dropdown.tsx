import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { BookSearchMatch, BookSearchConfig } from "@/types/book";
import { isCJKStr } from "@/utils/lang";
import { eventDispatcher } from "@/utils/event";
import { Search } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReaderStore } from "./reader-provider";
import SearchResults from "./search-results";
import { buildTextAnchor, parseTextAnchor } from "../utils/text-toc";
import { Input } from "@/components/ui/input";

const MINIMUM_SEARCH_TERM_LENGTH_DEFAULT = 2;
const MINIMUM_SEARCH_TERM_LENGTH_CJK = 1;
const MAX_RESULTS = 200;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildMatcher = (term: string, config?: Partial<BookSearchConfig>) => {
  const matchCase = Boolean(config?.matchCase);
  const matchWholeWords = Boolean(config?.matchWholeWords);
  const isCJK = isCJKStr(term);
  const flags = matchCase ? "g" : "gi";
  const escaped = escapeRegExp(term);

  if (matchWholeWords && !isCJK) {
    return new RegExp(`\\b${escaped}\\b`, flags);
  }

  return new RegExp(escaped, flags);
};

const buildExcerpt = (line: string, match: RegExpExecArray) => {
  const contextSize = 24;
  const start = Math.max(0, match.index - contextSize);
  const end = Math.min(line.length, match.index + match[0].length + contextSize);
  return {
    pre: line.slice(start, match.index),
    match: match[0],
    post: line.slice(match.index + match[0].length, end),
  };
};

const TextSearchDropdown: React.FC = () => {
  const openDropdown = useReaderStore((state) => state.openDropdown);
  const setOpenDropdown = useReaderStore((state) => state.setOpenDropdown);
  const textContent = useReaderStore((state) => state.bookData?.textContent);
  const bookId = useReaderStore((state) => state.bookId);
  const config = useReaderStore((state) => state.config);

  const [searchResults, setSearchResults] = useState<BookSearchMatch[] | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const queuedSearchTerm = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputFocusedRef = useRef(false);

  const isSearchDropdownOpen = openDropdown === "search";
  const searchConfig = config?.searchConfig as BookSearchConfig | undefined;

  const lines = useMemo(() => (textContent ? textContent.split(/\r?\n/) : []), [textContent]);

  const exceedMinSearchTermLength = (term: string) => {
    const minLength = isCJKStr(term) ? MINIMUM_SEARCH_TERM_LENGTH_CJK : MINIMUM_SEARCH_TERM_LENGTH_DEFAULT;
    return term.length >= minLength;
  };

  const resetSearch = useCallback(() => {
    setSearchResults([]);
  }, []);

  const handleSearch = useCallback(
    (term: string) => {
      if (!textContent || !term.trim()) {
        resetSearch();
        return;
      }

      const matcher = buildMatcher(term, searchConfig);
      const results: BookSearchMatch[] = [];

      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        if (!line) continue;

        let match: RegExpExecArray | null = null;
        matcher.lastIndex = 0;
        while ((match = matcher.exec(line))) {
          results.push({
            cfi: buildTextAnchor(index),
            excerpt: buildExcerpt(line, match),
          });

          if (queuedSearchTerm.current !== term) {
            resetSearch();
            return;
          }

          if (results.length >= MAX_RESULTS) {
            setSearchResults(results);
            return;
          }
        }
      }

      setSearchResults(results);
    },
    [lines, resetSearch, searchConfig, textContent],
  );

  const handleToggleSearchDropdown = (isOpen: boolean) => {
    setOpenDropdown?.(isOpen ? "search" : null);
    if (!isOpen) {
      setSearchResults(null);
      setSearchTerm("");
      setHasSearched(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    queuedSearchTerm.current = value;
    setSearchTerm(value);
    if (!value.trim()) {
      resetSearch();
      setHasSearched(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (exceedMinSearchTermLength(searchTerm)) {
        setHasSearched(true);
        handleSearch(searchTerm);
      }
    }
  };

  const handleHideSearchBar = useCallback(() => {
    setOpenDropdown?.(null);
    setSearchResults(null);
    setSearchTerm("");
    setHasSearched(false);
  }, [setOpenDropdown]);

  const handleResultSelect = useCallback(
    (cfi: string) => {
      const line = parseTextAnchor(cfi);
      if (line === null) return;
      eventDispatcher.dispatch("text-navigate", { bookId, line });

      setOpenDropdown?.(null);
      setSearchResults(null);
      setSearchTerm("");
      setHasSearched(false);
    },
    [bookId, setOpenDropdown],
  );

  const resultsBody = useMemo(() => {
    if (searchResults && searchResults.length > 0) {
      return (
        <div className="h-full overflow-y-auto">
          <SearchResults results={searchResults} onSelectResult={handleResultSelect} />
        </div>
      );
    }
    if (hasSearched && searchResults && searchResults.length === 0) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="p-12 text-center text-muted-foreground text-sm">未找到搜索结果</div>
        </div>
      );
    }
    return (
      <div className="flex h-full items-center justify-center">
        <div className="p-12 text-center text-muted-foreground text-sm">输入搜索词以查找内容</div>
      </div>
    );
  }, [handleResultSelect, hasSearched, searchResults]);

  const handleFocus = () => {
    inputFocusedRef.current = true;
  };

  const handleBlur = () => {
    inputFocusedRef.current = false;
  };

  useEffect(() => {
    if (isSearchDropdownOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSearchDropdownOpen]);

  useEffect(() => {
    if (!isSearchDropdownOpen) return;
    const handleKeyDownGlobal = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (inputRef.current && inputFocusedRef.current) {
          inputRef.current.blur();
        } else {
          handleHideSearchBar();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDownGlobal);
    return () => {
      window.removeEventListener("keydown", handleKeyDownGlobal);
    };
  }, [handleHideSearchBar, isSearchDropdownOpen]);

  if (textContent == null) {
    return null;
  }

  return (
    <DropdownMenu open={isSearchDropdownOpen} onOpenChange={handleToggleSearchDropdown}>
      <DropdownMenuTrigger asChild>
        <button
          className="btn btn-ghost flex items-center justify-center rounded-full p-0 outline-none focus:outline-none focus-visible:ring-0"
          title="搜索"
        >
          <Search size={18} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 p-0" align="end" side="bottom" sideOffset={4}>
        <div className="flex max-h-[calc(100vh-8rem)] flex-col">
          <div className="sticky top-0 z-10 flex-shrink-0 p-2">
            <div className="relative">
              <Search size={16} className="-translate-y-1/2 absolute top-1/2 left-3 z-10 text-gray-500" />
              <Input
                ref={inputRef}
                type="text"
                value={searchTerm}
                spellCheck={false}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                onBlur={handleBlur}
                placeholder="按回车键搜索..."
                className="h-8 w-full rounded-full pr-12 pl-10"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">{resultsBody}</div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default TextSearchDropdown;
