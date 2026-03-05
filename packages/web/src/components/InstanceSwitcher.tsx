import React from "react";
import { useNavigate } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useInstancesStore } from "../stores/instancesStore";
import { Icon } from "./ui/Icon";

function getInstanceLabel(realm: string, email: string): string {
  try {
    const host = new URL(realm.startsWith("http") ? realm : `https://${realm}`).hostname;
    return host || email;
  } catch {
    return email;
  }
}

export const InstanceSwitcher: React.FC = () => {
  const navigate = useNavigate();
  const instances = useInstancesStore((s) => s.instances);
  const currentInstanceId = useInstancesStore((s) => s.currentInstanceId);
  const setCurrentInstanceId = useInstancesStore((s) => s.setCurrentInstanceId);
  const removeInstance = useInstancesStore((s) => s.removeInstance);

  const current = instances.find((i) => i.id === currentInstanceId);
  const label = current ? getInstanceLabel(current.realm, current.email) : "Сервер";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-bg/50 transition-colors min-w-0 max-w-[200px]"
          aria-label="Выбрать сервер Zulip"
        >
          <Icon name="chatBubble" size={20} className="text-text-muted shrink-0" />
          <span className="truncate text-sm font-medium text-text-primary">{label}</span>
          <Icon name="chevron-down" size={16} className="text-text-muted shrink-0" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[220px] rounded-lg bg-bg-elevated border border-border-subtle shadow-lg py-1 z-50"
          sideOffset={4}
          align="start"
        >
          {instances.map((inst) => (
            <DropdownMenu.Item
              key={inst.id}
              onSelect={() => setCurrentInstanceId(inst.id)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-bg/80 outline-none cursor-pointer data-[highlighted]:bg-accent/20 group/item"
            >
              <div className="flex-1 min-w-0 flex flex-col items-start gap-0.5">
                <span className="font-medium truncate w-full">{getInstanceLabel(inst.realm, inst.email)}</span>
                <span className="text-xs text-text-muted truncate w-full">{inst.email}</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeInstance(inst.id);
                }}
                className="p-1.5 rounded text-text-muted hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover/item:opacity-100 transition-opacity"
                aria-label="Удалить сервер"
              >
                <Icon name="close" size={14} />
              </button>
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="h-px bg-border-subtle my-1" />
          <DropdownMenu.Item
            onSelect={() => navigate("/login")}
            className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-bg/80 outline-none cursor-pointer data-[highlighted]:bg-accent/20"
          >
            <Icon name="add" size={16} className="text-text-muted" />
            Добавить сервер
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
