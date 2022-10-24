/**
 * Gerenciador de eventos
 * via: https://github.com/fskreuz/MiniEvent
 */
export default class EventManager {
  constructor () {
    this.events = {}
  }
  on (event, handler) {
    if (!this.events[event]) this.events[event] = []
    this.events[event] = [...this.events[event], handler]
  }
  off (event, handler) {
    if (!this.events[event]) return
    this.events[event] = this.events[event].filter(h => h !== handler)
  }
  emit (event, ...args) {
    if (!this.events[event]) return
    this.events[event].forEach(handler => handler(...args))
  }
}
