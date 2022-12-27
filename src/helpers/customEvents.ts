export const event = {
  list: new Map(),
  on(eventType: string, eventAction: any) {
    if (this.list.has(eventType)) {
      this.list.has(eventType)
    } else {
      this.list.set(eventType, [])
    }
    if (this.list.get(eventType)) this.list.get(eventType).push(eventAction)
    return this
  },

  emit(eventType: string, ...args: any) {
    if (this.list.get(eventType)) {
      this.list.get(eventType).forEach((cb: any) => {
        cb(...args)
      })
    }
  }
}
