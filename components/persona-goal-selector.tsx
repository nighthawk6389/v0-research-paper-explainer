"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { ChevronRight, Users } from "lucide-react"

export const PERSONA_OPTIONS = [
  "High-school student",
  "Undergraduate CS",
  "Software engineer",
  "Product manager",
  "PhD researcher (adjacent field)",
  "Clinician",
  "Investor",
] as const

export const GOAL_OPTIONS = [
  "Understand the big idea",
  "Implement it",
  "Review/critique it",
  "Teach it",
  "Replicate the results",
] as const

export const TONE_OPTIONS = ["Concise", "Friendly", "Technical"] as const

export interface PersonaGoalValue {
  persona?: string
  goal?: string
  tone?: string
}

interface PersonaGoalSelectorProps {
  value: PersonaGoalValue
  onChange: (v: PersonaGoalValue) => void
  disabled?: boolean
  defaultOpen?: boolean
}

export function PersonaGoalSelector({
  value,
  onChange,
  disabled,
  defaultOpen = false,
}: PersonaGoalSelectorProps) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between text-xs bg-muted/60 hover:bg-muted border border-border/60 text-foreground"
        >
          <span className="flex items-center gap-2">
            <Users className="size-3.5 text-muted-foreground" />
            Customize audience & goal
          </span>
          <ChevronRight className="size-3.5 data-[state=open]:rotate-90" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid gap-2 pt-2 pb-1">
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Persona
            </label>
            <Select
              value={value.persona ?? ""}
              onValueChange={(v) => onChange({ ...value, persona: v || undefined })}
              disabled={disabled}
            >
              <SelectTrigger className="h-8 text-xs mt-0.5">
                <SelectValue placeholder="Select audience" />
              </SelectTrigger>
              <SelectContent>
                {PERSONA_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Goal
            </label>
            <Select
              value={value.goal ?? ""}
              onValueChange={(v) => onChange({ ...value, goal: v || undefined })}
              disabled={disabled}
            >
              <SelectTrigger className="h-8 text-xs mt-0.5">
                <SelectValue placeholder="Select goal" />
              </SelectTrigger>
              <SelectContent>
                {GOAL_OPTIONS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Tone
            </label>
            <Select
              value={value.tone ?? ""}
              onValueChange={(v) => onChange({ ...value, tone: v || undefined })}
              disabled={disabled}
            >
              <SelectTrigger className="h-8 text-xs mt-0.5">
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                {TONE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t.toLowerCase()}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
