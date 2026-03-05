import React, { useState, useRef } from "react";
import EmojiPicker, { Theme, type EmojiClickData } from "emoji-picker-react";
import { SCROLL_AREA_CLASS } from "../../lib/constants";
import { stripHtml } from "../../lib/html";
import { Icon } from "./Icon";

export interface ReplyQuote {
  id: number;
  content: string;
  sender_full_name: string;
}

interface MessageComposerProps {
  onSend?: (content: string, subject?: string, files?: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Тема берётся из выбора в боковом меню, в композере не выбирается */
  activeTopic?: string;
  /** Цитата для ответа (показывается над полем ввода, подставляется в тело при отправке) */
  replyQuote?: ReplyQuote | null;
  onClearReply?: () => void;
}

const QUOTE_PREVIEW_MAX = 80;

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onSend,
  disabled = false,
  placeholder = "Написать сообщение...",
  activeTopic,
  replyQuote,
  onClearReply,
}) => {
  const [value, setValue] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (!value.trim() || disabled) return;
    const subject = activeTopic ?? "general";
    let body = value.trim();
    if (replyQuote) {
      const quoteBlock = `> **${replyQuote.sender_full_name}:**\n\n${replyQuote.content}\n\n`;
      body = quoteBlock + body;
      onClearReply?.();
    }
    onSend?.(body, subject, files.length > 0 ? files : undefined);
    setValue("");
    setFiles([]);
  };

  const handleEmojiClick = (data: EmojiClickData) => {
    setValue((prev) => prev + (data.emoji ?? ""));
  };

  const handleAttachClick = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected?.length) return;
    setFiles((prev) => [...prev, ...Array.from(selected)]);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex-shrink-0 border-t border-border-subtle bg-composer-outer">
      {/* Прикреплённые файлы */}
      {files.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2">
          {files.map((file, i) => (
            <span
              key={`${file.name}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-bg border border-border-subtle px-2 py-1 text-xs text-text-primary"
            >
              <span className="truncate max-w-[120px]" title={file.name}>
                {file.name}
              </span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="p-0.5 rounded text-text-muted hover:bg-bg-elevated hover:text-text-primary"
                aria-label="Удалить"
              >
                <Icon name="close" size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {replyQuote && (
        <div className="flex items-start gap-2 px-4 py-2 border-b border-border-subtle bg-bg/50">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-text-muted">Ответ на: {replyQuote.sender_full_name}</p>
            <p className="text-sm text-text-primary line-clamp-2 mt-0.5">
              {stripHtml(replyQuote.content).trim().length <= QUOTE_PREVIEW_MAX
                ? stripHtml(replyQuote.content).trim()
                : stripHtml(replyQuote.content).trim().slice(0, QUOTE_PREVIEW_MAX) + "…"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClearReply}
            className="flex-shrink-0 p-1 rounded text-text-muted hover:bg-bg-elevated hover:text-text-primary"
            aria-label="Отменить ответ"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      {/* Строка ввода по макету Input field.svg: внешняя обводка #333, внутреннее поле #1B1B1D, иконки #707070, кнопка отправки оранжевая */}
      <div className="px-3 pb-3 pt-0">
        <div className="flex items-stretch rounded-xl overflow-hidden bg-bg min-h-[56px]">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
            accept="*/*"
          />

          <button
            type="button"
            onClick={handleAttachClick}
            disabled={disabled}
            className="flex-shrink-0 flex items-center justify-center w-12 h-14 text-composer-icon hover:text-text-primary hover:bg-bg-elevated/50 disabled:opacity-50 transition-colors"
            aria-label="Прикрепить файл"
          >
            <Icon name="attach" size={20} />
          </button>

          <div className="relative flex-shrink-0 flex items-center justify-center w-12 h-14">
            <button
              type="button"
              onClick={() => setEmojiOpen((o) => !o)}
              disabled={disabled}
              className="absolute inset-0 flex items-center justify-center text-composer-icon hover:text-text-primary hover:bg-bg-elevated/50 disabled:opacity-50 transition-colors"
              aria-label="Смайлики"
            >
              <Icon name="smile" size={20} />
            </button>
            {emojiOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  aria-hidden
                  onClick={() => setEmojiOpen(false)}
                />
                <div className="absolute bottom-full left-0 mb-1 z-20 shadow-xl rounded-xl overflow-hidden border border-border-subtle bg-bg-elevated">
                  <EmojiPicker
                    onEmojiClick={handleEmojiClick}
                    theme={document.documentElement.dataset.theme === "light" ? Theme.LIGHT : Theme.DARK}
                    width={320}
                    height={360}
                    searchDisabled={false}
                    previewConfig={{ showPreview: false }}
                  />
                </div>
              </>
            )}
          </div>

          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={`flex-1 min-w-0 resize-none border-0 bg-transparent px-3 py-3 text-sm text-text-primary placeholder:text-composer-icon outline-none min-h-[56px] max-h-32 ${SCROLL_AREA_CLASS}`}
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={disabled}
            className="flex-shrink-0 flex items-center justify-center gap-1.5 h-14 min-w-[56px] px-4 bg-composer-send text-bg hover:opacity-90 disabled:opacity-50 transition-opacity rounded-r-xl"
            aria-label="Отправить"
          >
            <Icon name="send" size={20} />
            <span className="hidden sm:inline text-sm font-medium">Отправить</span>
          </button>
        </div>
      </div>
    </div>
  );
};
