// Runs the on-device detector over the replay frames and saves what it found, so replay shows real model output
// instead of scripted answers. Same model files and the same judging code as the live desk.
// Run: npx vite-node scripts/record-detections.ts

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as tf from '@tensorflow/tfjs-core'
import '@tensorflow/tfjs-backend-cpu'
import * as cocoSsd from '@tensorflow-models/coco-ssd'
import jpeg from 'jpeg-js'
import { bodyColour, DETECTOR_MODEL, vehiclesOnly, type RawDetection } from '../lib/arrivalops/detector'

const MODEL_DIR = join(process.cwd(), 'public/models/ssdlite_mobilenet_v2')
const FRAMES = ['lot-bays-clear.jpg', 'lot-car-in-bay.jpg']

function fromDisk(): tf.io.IOHandler {
  return {
    async load() {
      const manifest = JSON.parse(readFileSync(join(MODEL_DIR, 'model.json'), 'utf8'))
      const shards = manifest.weightsManifest.flatMap((g: { paths: string[] }) => g.paths).map((p: string) => readFileSync(join(MODEL_DIR, p)))
      const weightData = new Uint8Array(Buffer.concat(shards)).buffer
      return {
        modelTopology: manifest.modelTopology,
        format: manifest.format,
        generatedBy: manifest.generatedBy,
        convertedBy: manifest.convertedBy,
        weightSpecs: manifest.weightsManifest.flatMap((g: { weights: tf.io.WeightsManifestEntry[] }) => g.weights),
        weightData,
      }
    },
  }
}

async function main() {
  await tf.setBackend('cpu')
  // coco-ssd hands modelUrl straight to loadGraphModel, which also takes a handler
  const model = await cocoSsd.load({ base: 'lite_mobilenet_v2', modelUrl: fromDisk() as unknown as string })
  const out: Record<string, unknown> = { model: DETECTOR_MODEL, recordedAt: new Date().toISOString(), frames: {} }
  for (const file of FRAMES) {
    const img = jpeg.decode(readFileSync(join(process.cwd(), 'public/replay', file)), { useTArray: true })
    const pixels = tf.tensor3d(rgb(img.data), [img.height, img.width, 3], 'int32')
    const started = Date.now()
    const raw = (await model.detect(pixels, 20, 0.2)) as RawDetection[]
    const latencyMs = Date.now() - started
    pixels.dispose()
    const vehicles = vehiclesOnly(raw, img.width, img.height).map((d) => ({
      ...d,
      score: r3(d.score),
      box: { x: r3(d.box.x), y: r3(d.box.y), w: r3(d.box.w), h: r3(d.box.h) },
      colour: bodyColour(img.data, img.width, img.height, d.box),
    }))
    ;(out.frames as Record<string, unknown>)[`/replay/${file}`] = { latencyMs, vehicles, allClasses: raw.map((r) => `${r.class} ${r.score.toFixed(2)}`) }
    console.log(file, latencyMs + 'ms', JSON.stringify(vehicles))
  }
  writeFileSync(join(process.cwd(), 'lib/arrivalops/replayDetections.json'), JSON.stringify(out, null, 2) + '\n')
}

const r3 = (n: number) => Math.round(n * 1000) / 1000

function rgb(rgba: Uint8Array) {
  const out = new Int32Array((rgba.length / 4) * 3)
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    out[j] = rgba[i]
    out[j + 1] = rgba[i + 1]
    out[j + 2] = rgba[i + 2]
  }
  return out
}

main()
