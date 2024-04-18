class Timer {
  private startTime: number | null
  private elapsedTime: number

  constructor() {
    this.startTime = null
    this.elapsedTime = 0
  }

  start(): void {
    if (this.startTime !== null) {
      console.warn("Timer is already running!")
      return
    }
    this.startTime = Date.now() - this.elapsedTime
  }

  stop(): void {
    if (this.startTime === null) {
      console.warn("Timer is not running!")
      return
    }
    this.elapsedTime = Date.now() - this.startTime
    this.startTime = null
  }

  reset(): void {
    this.startTime = null
    this.elapsedTime = 0
  }

  getTime(): string {
    if (this.startTime !== null) {
      this.elapsedTime = Date.now() - this.startTime
    }

    let totalSeconds = Math.floor(this.elapsedTime / 1000)
    let hours = Math.floor(totalSeconds / 3600)
    let minutes = Math.floor((totalSeconds - hours * 3600) / 60)
    let seconds = totalSeconds - hours * 3600 - minutes * 60

    return `${this.pad(hours)}:${this.pad(minutes)}:${this.pad(seconds)}`
  }

  private pad(num: number): string {
    return num.toString().padStart(2, "0")
  }
}

export default Timer
