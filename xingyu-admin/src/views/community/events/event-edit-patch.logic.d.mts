export declare function eventUpdatePatch(
  original: {
    title: string
    body: string
    status: string
    submissionOpen: boolean
    startsAt?: string | null
    endsAt?: string | null
  },
  current: {
    title: string
    body: string
    status: string
    submissionOpen: boolean
    startsAt?: string | null
    endsAt?: string | null
  }
): Record<string, string | boolean | null>
