import { Gpio } from 'onoff'

function avg(values: number[]) {
  return values.reduce((pre, cur) => pre + cur) / values.length
}

function wait(ms: number) {
  // hacky synchronous wait
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

export class HX711 {
  private clockGpio: Gpio
  private dataGpio: Gpio

  constructor(
    public clockPin: number,
    public dataPin: number,
    public scale = 1,
    public offset = 0
  ) {
    this.clockGpio = new Gpio(clockPin, 'out')
    this.dataGpio = new Gpio(dataPin, 'in')

    this.readRawAvg() // read flush things out
  }

  get isReady() {
    return this.dataGpio.readSync() == 0
  }

  public powerUp() {
    this.clockGpio.writeSync(0)
    wait(1)
  }

  public powerDown() {
    this.clockGpio.writeSync(1)
    wait(1)
  }

  private readRaw() {
    // wrapping in powerUp and powerDown seem to make data much
    // more stable at the cost of cpu usage and read frequency
    this.powerUp()

    while (!this.isReady) {}

    let data = 0

    for (let i = 0; i < 24; i++) {
      this.clockGpio.writeSync(1)
      this.clockGpio.writeSync(0)
      data <<= 1
      data |= this.dataGpio.readSync()
    }

    data ^= 0x800000

    this.powerDown()

    return data
  }

  private readRawAvg(times: number = 10) {
    const values: number[] = []
    for (let i = 0; i < times; i++) {
      values.push(this.readRaw())
    }
    return avg(values)
  }

  public read() {
    return (this.readRaw() + this.offset) / this.scale
  }

  public tare() {
    this.offset = -this.readRawAvg()
  }
}
