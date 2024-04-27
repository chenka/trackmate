class Timer {
  private startTime: string | null
  private endTime: string | null
  private elapsedTime: number

  constructor() {
    this.startTime = null
    this.endTime = null
    this.elapsedTime = 0
  }

  start(): void {
    if (this.startTime !== null) {
      console.warn("Timer is already running!")
      return
    }
    this.startTime = new Date().toISOString()
    this.endTime = null
  }

  stop(): void {
    if (this.startTime === null) {
      console.warn("Timer is not running!")
      return
    }
    this.endTime = new Date().toISOString()
    this.elapsedTime =
      new Date(this.endTime).getTime() - new Date(this.startTime).getTime()
  }

  reset(): void {
    this.startTime = null
    this.endTime = null
    this.elapsedTime = 0
  }

  getTime(): string {
    let currentElapsed = this.elapsedTime
    if (this.startTime !== null) {
      currentElapsed +=
        new Date().getTime() - new Date(this.startTime).getTime()
    }

    let totalSeconds = Math.floor(currentElapsed / 1000)
    let hours = Math.floor(totalSeconds / 3600)
    let minutes = Math.floor((totalSeconds - hours * 3600) / 60)
    let seconds = totalSeconds - hours * 3600 - minutes * 60

    return `${this.pad(hours)}:${this.pad(minutes)}:${this.pad(seconds)}`
  }

  getStartTime(): string | null {
    return this.startTime
  }

  getEndTime(): string | null {
    return this.endTime
  }

  private pad(num: number): string {
    return num.toString().padStart(2, "0")
  }
}

export default Timer
