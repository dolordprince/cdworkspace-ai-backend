import React, { useState, useEffect, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Icon } from "./ui/Icon";
import { ScrollArea } from "./ui/ScrollArea";
import { fetchMessages, type MockMessage } from "../lib/zulipClient";

const DEBOUNCE_MS = 300;

interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMessage: (msg: MockMessage) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  open,
  onOpenChange,
  onSelectMessage,
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MockMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchMessages(undefined, undefined, q);
      setResults(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => runSearch(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, open, runSearch]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  const handleSelect = (msg: MockMessage) => {
    onSelectMessage(msg);
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-[20%] -translate-x-1/2 z-50 w-full max-w-xl rounded-xl bg-bg-elevated border border-border-subtle shadow-xl flex flex-col max-h-[60vh] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
            <Icon name="search" size={20} className="text-text-muted shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по сообщениям..."
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
              autoFocus
            />
          </div>
          <ScrollArea className="flex-1 p-2">
            {loading && (
              <p className="text-sm text-text-muted py-4 text-center">
                Поиск...
              </p>
            )}
            {!loading && query.trim() && results.length === 0 && (
              <p className="text-sm text-text-muted py-4 text-center">
                Ничего не найдено
              </p>
            )}
            {!loading && results.length > 0 && (
              <ul className="space-y-0.5">
                {results.map((msg) => (
                  <li key={msg.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(msg)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-bg/60 text-sm"
                    >
                      <div className="flex items-center gap-2 text-[11px] text-text-muted mb-0.5">
                        <span>{msg.sender_full_name}</span>
                        <span>·</span>
                        <span>
                          #{msg.channel ?? "?"} › #{msg.subject}
                        </span>
                      </div>
                      <p className="text-text-primary line-clamp-2 truncate">
                        {msg.content}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
