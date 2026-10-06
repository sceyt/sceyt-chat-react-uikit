import { IUser } from '../../types'

export const APPLY_PRESENCE_USERS = 'APPLY_PRESENCE_USERS'

type Client = { getUsers: (ids: string[]) => Promise<IUser[]> }
type Dispatch = (action: { type: string; payload: { users: IUser[] } }) => void

export class PresenceRegistry {
  private counts = new Map<string, number>()
  private pending = new Set<string>()
  private dispatch: Dispatch | null = null
  private client: Client | null = null
  private connected = false
  private tabActive = true
  private session = 0
  private inFlight = false
  private fullRefreshPending = false
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private batchTimer: ReturnType<typeof setTimeout> | null = null

  subscribe(ids: string[]): () => void {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
    uniqueIds.forEach((id) => {
      const count = this.counts.get(id) || 0
      this.counts.set(id, count + 1)
      if (count === 0) this.pending.add(id)
    })
    this.syncTimer()
    if (this.pending.size) this.scheduleBatch()

    let removed = false
    return () => {
      if (removed) return
      removed = true
      uniqueIds.forEach((id) => {
        const count = this.counts.get(id) || 0
        if (count <= 1) {
          this.counts.delete(id)
          this.pending.delete(id)
        } else {
          this.counts.set(id, count - 1)
        }
      })
      this.syncTimer()
    }
  }

  configure(dispatch: Dispatch, client: Client | null) {
    this.dispatch = dispatch
    this.resetSession(client)
  }

  resetSession(client: Client | null) {
    this.session++
    this.client = client
    this.inFlight = false
    this.pending.clear()
    this.fullRefreshPending = false
    this.clearBatch()
    this.syncTimer()
    if (this.canPoll()) this.requestRefresh()
  }

  setAvailability(connected: boolean, tabActive: boolean) {
    const wasAvailable = this.canPoll()
    this.connected = connected
    this.tabActive = tabActive
    if (wasAvailable && !this.canPoll()) {
      this.session++
      this.inFlight = false
      this.pending.clear()
      this.fullRefreshPending = false
    }
    this.syncTimer()
    if (!wasAvailable && this.canPoll()) this.requestRefresh()
  }

  dispose() {
    this.session++
    this.client = null
    this.dispatch = null
    this.connected = false
    this.counts.clear()
    this.pending.clear()
    this.fullRefreshPending = false
    this.inFlight = false
    this.clearBatch()
    this.syncTimer()
  }

  private canPoll() {
    return !!this.client && !!this.dispatch && this.connected && this.tabActive && this.counts.size > 0
  }

  private clearBatch() {
    if (this.batchTimer) clearTimeout(this.batchTimer)
    this.batchTimer = null
  }

  private syncTimer() {
    if (this.canPoll()) {
      if (!this.pollTimer) this.pollTimer = setInterval(() => this.requestRefresh(), 4000)
    } else {
      if (this.pollTimer) clearInterval(this.pollTimer)
      this.pollTimer = null
      this.clearBatch()
      if (!this.connected || !this.tabActive) {
        this.pending.clear()
        this.fullRefreshPending = false
      }
    }
  }

  private scheduleBatch() {
    if (!this.canPoll() || this.batchTimer) return
    this.batchTimer = setTimeout(() => {
      this.batchTimer = null
      this.flush()
    }, 150)
  }

  private requestRefresh() {
    if (!this.canPoll()) return
    this.fullRefreshPending = true
    this.clearBatch()
    this.flush()
  }

  private flush() {
    if (!this.canPoll() || this.inFlight) return
    const ids = this.fullRefreshPending
      ? Array.from(this.counts.keys())
      : Array.from(this.pending).filter((id) => this.counts.has(id))
    this.fullRefreshPending = false
    ids.forEach((id) => this.pending.delete(id))
    if (!ids.length) return

    const session = this.session
    const client = this.client as Client
    this.inFlight = true
    Promise.resolve()
      .then(() => client.getUsers(ids))
      .then((users) => {
        if (session !== this.session || !this.canPoll()) return
        const activeUsers = (users || []).filter((user) => user?.id && this.counts.has(user.id))
        if (activeUsers.length) this.dispatch?.({ type: APPLY_PRESENCE_USERS, payload: { users: activeUsers } })
      })
      .catch(() => {
        // The regular interval is the retry; never start a separate retry timer.
        if (session === this.session) this.fullRefreshPending = false
      })
      .finally(() => {
        if (session !== this.session) return
        this.inFlight = false
        if (this.fullRefreshPending) this.flush()
        else if (this.pending.size) this.scheduleBatch()
      })
  }
}

export const presenceRegistry = new PresenceRegistry()
