import { Gpio } from 'onoff'

function avg(values: number[]) {
  return values.reduce((pre, cur) => pre + cur) / values.length
}

export class HX711 {
  private clockGpio: Gpio
  private dataGpio: Gpio
  private isReading = false

  constructor(
    public clockPin: number,
    public dataPin: number,
    public gain: 128 | 64 | 32 = 128,
    public scale = 1,
    public offset = 0
  ) {
    this.clockGpio = new Gpio(clockPin, 'out')
    this.dataGpio = new Gpio(dataPin, 'in', 'both')
    this.powerUp()
  }

  get gainBits() {
    return { 128: 1, 64: 3, 32: 2 }[this.gain]
  }

  get isReady() {
    return this.dataGpio.readSync() == 0 && !this.isReading
  }

  private readBit() {
    this.clockGpio.writeSync(1)
    const value = this.dataGpio.readSync()
    this.clockGpio.writeSync(0)
    return value
  }

  private pulse(times: number) {
    let value = 0
    for (let i = 0; i < times; i++) {
      value <<= 1
      value |= this.readBit()
    }
    return value
  }

  private readByte() {
    return this.pulse(8)
  }

  private readRawBytes() {
    while (!this.isReady) {}
    this.isReading = true
    // read three bytes (32 bits)
    const byte1 = this.readByte()
    const byte2 = this.readByte()
    const byte3 = this.readByte()
    // set gain bits for next reading
    for (let i = 0; i < this.gainBits; i++) {
      this.readByte()
    }
    this.isReading = false
    return [byte1, byte2, byte3]
  }

  private readRaw() {
    const bytes = this.readRawBytes()
    const filter = bytes[0] & 0x80 ? 0xff : 0x00
    const value = (filter << 24) | (bytes[0] << 16) | (bytes[1] << 8) | bytes[2]
    return value + this.offset
  }

  public readRawAvg(times = 10) {
    const readings: number[] = []
    for (let i = 0; i < times; i++) {
      readings.push(this.readRaw())
    }
    return avg(readings)
  }

  public read() {
    return this.readRaw() / this.scale
  }

  public readAvg(times = 10) {
    return this.readRawAvg(times) / this.scale
  }

  public tare(times = 10) {
    this.offset = -this.readRawAvg(times)
  }

  public powerUp() {
    this.clockGpio.writeSync(0)
  }

  public powerDown() {
    this.clockGpio.writeSync(0)
    this.clockGpio.writeSync(1)
  }
}
