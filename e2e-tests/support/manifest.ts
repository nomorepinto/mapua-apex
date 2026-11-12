import fs from "node:fs"

import { manifestPath } from "./env"

type ManifestData = {
  ids: string[]
  session_ids: string[]
  student_numbers: string[]
  subs: string[]
  usernames: string[]
  created_signatory_ids: string[]
  created_org_ids: string[]
  preexisting_cdm_id: string | null
  preexisting_cdm_holder: string | null
  [key: string]: unknown
}

const ID_KEYS = [
  "campus_id",
  "signatory_id",
  "organization_id",
  "reservable_id",
  "booking_id",
  "event_id",
  "submission_id",
  "posteval_id",
  "change_id",
] as const

let chain: Promise<void> = Promise.resolve()

function read(): ManifestData {
  const raw = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as ManifestData
  raw.ids ??= []
  raw.student_numbers ??= []
  raw.created_signatory_ids ??= []
  raw.created_org_ids ??= []
  return raw
}

function write(data: ManifestData) {
  fs.writeFileSync(manifestPath, JSON.stringify(data, null, 2))
}

export function updateManifest(mutate: (data: ManifestData) => void): Promise<void> {
  chain = chain.then(() => {
    const data = read()
    mutate(data)
    write(data)
  })
  return chain
}

function addId(data: ManifestData, value: unknown) {
  if (typeof value === "string" && value && !data.ids.includes(value)) data.ids.push(value)
}

function unwrap(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null
  const record = body as Record<string, unknown>
  const inner = record.data
  if (inner && typeof inner === "object" && !Array.isArray(inner)) return inner as Record<string, unknown>
  return record
}

/** Record ids from a JSON body the page already received. */
export function rememberBody(body: unknown, sourceUrl = ""): Promise<void> {
  return updateManifest((data) => {
    const record = unwrap(body)
    if (!record) return
    const layers = [record]
    for (const value of Object.values(record)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        layers.push(value as Record<string, unknown>)
      }
    }
    for (const layer of layers) {
      for (const key of ID_KEYS) addId(data, layer[key])
    }
    const signatoryId = layers.map((layer) => layer.signatory_id).find((value) => typeof value === "string")
    if (sourceUrl.includes("/signatories") && typeof signatoryId === "string") {
      if (!data.created_signatory_ids.includes(signatoryId)) data.created_signatory_ids.push(signatoryId)
    }
    const documentNumber = layers
      .map((layer) => layer.document_number)
      .find((value) => typeof value === "string")
    if (typeof documentNumber === "string") {
      const day = /^SAAF-(\d{6})-\d{3}$/.exec(documentNumber)
      if (day?.[1]) addId(data, `COUNTER#SAAF#${day[1]}`)
    }
    const organizationId = layers.map((layer) => layer.organization_id).find((value) => typeof value === "string")
    if (sourceUrl.includes("/organizations") && typeof organizationId === "string") {
      if (!data.created_org_ids.includes(organizationId)) data.created_org_ids.push(organizationId)
    }
  })
}

export function rememberStudentNumber(value: string): Promise<void> {
  return updateManifest((data) => {
    if (!data.student_numbers.includes(value)) data.student_numbers.push(value)
  })
}

export function rememberPreexistingCdm(id: string, holder: string | null): Promise<void> {
  return updateManifest((data) => {
    data.preexisting_cdm_id = id
    data.preexisting_cdm_holder = holder
  })
}
