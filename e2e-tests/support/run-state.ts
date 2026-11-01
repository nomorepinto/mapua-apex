import fs from "node:fs"
import path from "node:path"

import { runStatePath, tag } from "./env"

export type PaperRecord = {
  title: string
  org: string
  roles: string[]
  desks: string[]
}

export type RunState = {
  tag: string
  campus: string
  people: Record<string, string>
  orgs: Record<string, string>
  cdmName: string
  papers: Record<string, PaperRecord>
}

function empty(): RunState {
  return { tag, campus: "", people: {}, orgs: {}, cdmName: "", papers: {} }
}

export function readRun(): RunState {
  if (!fs.existsSync(runStatePath)) return empty()
  return { ...empty(), ...(JSON.parse(fs.readFileSync(runStatePath, "utf8")) as RunState) }
}

export function writeRun(mutate: (state: RunState) => void) {
  fs.mkdirSync(path.dirname(runStatePath), { recursive: true })
  const state = readRun()
  mutate(state)
  fs.writeFileSync(runStatePath, JSON.stringify(state, null, 2))
}
