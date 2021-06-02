import { Gpio } from 'onoff'

export class HX711 {
  private clockGpio: Gpio
  private dataGpio: Gpio
  private minMs = 10
  private lastRead = 0
  private isReading = false

  constructor(
    public clockPin: number,
    public dataPin: number,
    public gain: 128 | 64 | 32 = 128,
    public tareOffset = 0
  ) {
    this.clockGpio = new Gpio(clockPin, 'out')
    this.dataGpio = new Gpio(dataPin, 'in', 'falling')
  }

  get gainBits() {
    return { 128: 1, 64: 3, 32: 2 }[this.gain]
  }

  get isReady() {
    return new Date().valueOf() - this.lastRead >= this.minMs && !this.isReading
  }

  private readBit() {
    this.clockGpio.writeSync(1)
    this.clockGpio.writeSync(0)

    return this.dataGpio.readSync()
  }

  private readByte() {
    let byte = 0

    for (let i = 0; i < 8; i++) {
      byte <<= 1
      byte |= this.readBit()
    }

    return byte
  }

  private readRawBytes() {
    if (!this.isReady) return

    this.isReading = true

    const byte1 = this.readByte()
    const byte2 = this.readByte()
    const byte3 = this.readByte()

    for (let i = 0; i < this.gainBits; i++) {
      this.readByte()
    }

    this.isReading = false

    return [byte1, byte2, byte3]
  }

  public read() {
    const bytes = this.readRawBytes()
    const tcv = (bytes[0] << 16) | (bytes[1] << 8) | bytes[2]
    return -(tcv & 0x800000) + (tcv & 0x7fffff) - this.tareOffset
  }

  public tare() {
    const reading = this.read()
    this.tareOffset = reading
  }
}
