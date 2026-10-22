// Loads the on-device detector in the browser, once, from the model files this app serves itself
// (public/models), so it needs no account and no third-party request. WebGL when the device has it.

import type { ObjectDetection } from '@tensorflow-models/coco-ssd'
import { DETECTOR_MODEL_URL } from './detector'

let loading: Promise<ObjectDetection> | null = null

export function loadDetector(): Promise<ObjectDetection> {
  loading ??= (async () => {
    const tf = await import('@tensorflow/tfjs-core')
    await import('@tensorflow/tfjs-backend-cpu')
    await import('@tensorflow/tfjs-backend-webgl')
    await tf.ready()
    const coco = await import('@tensorflow-models/coco-ssd')
    return coco.load({ base: 'lite_mobilenet_v2', modelUrl: DETECTOR_MODEL_URL })
  })()
  // A failed load (offline, no WebGL and no CPU fallback) may be retried later.
  loading.catch(() => {
    loading = null
  })
  return loading
}
