import React from "react";

interface TopicListProps {
  topics: string[];
  activeTopic: string | undefined;
  onSelectTopic: (topic: string | null) => void;
  allTopicsLabel: string;
}

export const TopicList: React.FC<TopicListProps> = ({
  topics,
  activeTopic,
  onSelectTopic,
  allTopicsLabel,
}) => {
  return (
    <div className="flex-shrink-0 flex items-center gap-1 px-4 py-2 border-b border-border-subtle bg-bg-elevated/50 overflow-x-auto">
      <button
        type="button"
        onClick={() => onSelectTopic(null)}
        className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          activeTopic === undefined
            ? "bg-accent/20 text-accent border border-accent/40"
            : "text-text-muted hover:bg-bg/60 hover:text-text-primary border border-transparent"
        }`}
      >
        {allTopicsLabel}
      </button>
      {topics.map((topic) => {
        const isActive = activeTopic === topic;
        return (
          <button
            key={topic}
            type="button"
            onClick={() => onSelectTopic(topic)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-accent/20 text-accent border border-accent/40"
                : "text-text-muted hover:bg-bg/60 hover:text-text-primary border border-transparent"
            }`}
          >
            #{topic}
          </button>
        );
      })}
    </div>
  );
};
