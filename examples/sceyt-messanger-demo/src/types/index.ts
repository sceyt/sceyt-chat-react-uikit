export interface IUser {
  id: string
  firstName: string
  lastName: string
  avatarUrl?: string
  state: string
  blocked?: boolean
  presence?: {
    state: string
    status?: string
    lastActiveAt?: Date | null
  }
}
