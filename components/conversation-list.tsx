"use client"

import { useCallback } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Conversation } from "@/lib/storage/types"

interface ConversationListProps {
  conversations: Conversation[]
  onOpen: (conversation: Conversation) => void
}

export function ConversationList({ conversations, onOpen }: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground p-4">
        No saved explanations yet. Click a section to explain and it will be saved here.
      </p>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <ul className="p-2 space-y-1">
        {conversations.map((c) => (
          <li key={c.conversationId}>
            <button
              type="button"
              onClick={() => onOpen(c)}
              className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors"
            >
              <span className="font-medium truncate block">
                {c.title || `${c.anchor.type}: ${c.anchor.sectionId}`}
              </span>
              <span className="text-xs text-muted-foreground">
                {c.difficulty} · {c.messages.length} messages
              </span>
            </button>
          </li>
        ))}
      </ul>
    </ScrollArea>
  )
}
