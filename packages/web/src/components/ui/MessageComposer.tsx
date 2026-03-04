import React, { useState, useRef } from "react";
import EmojiPicker, { type EmojiClickData } from "emoji-picker-react";
import { SCROLL_AREA_CLASS } from "../../lib/constants";
import { Icon } from "./Icon";

interface MessageComposerProps {
  onSend?: (content: string, subject?: string, files?: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Тема берётся из выбора в боковом меню, в композере не выбирается */
  activeTopic?: string;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onSend,
  disabled = false,
  placeholder = "Написать сообщение...",
  activeTopic,
}) => {
  const [value, setValue] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (!value.trim() || disabled) return;
    const subject = activeTopic ?? "general";
    onSend?.(value.trim(), subject, files.length > 0 ? files : undefined);
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
                    theme={document.documentElement.dataset.theme === "light" ? "light" : "dark"}
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
