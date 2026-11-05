#!/usr/bin/env node
/**
 * Copies three's Draco and Basis (KTX2) decoders into public/assets/decoders/
 * so the loaders can fetch them by fixed file name. Runs before dev and build;
 * the copies are git-ignored and always match the installed three version.
 */
import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const libs = 'node_modules/three/examples/jsm/libs'
const out = 'public/assets/decoders'
const files = [
  ['draco/gltf/draco_decoder.wasm', 'draco/draco_decoder.wasm'],
  ['draco/gltf/draco_wasm_wrapper.js', 'draco/draco_wasm_wrapper.js'],
  ['basis/basis_transcoder.js', 'basis/basis_transcoder.js'],
  ['basis/basis_transcoder.wasm', 'basis/basis_transcoder.wasm'],
]
for (const [from, to] of files) {
  const dest = path.join(out, to)
  await mkdir(path.dirname(dest), { recursive: true })
  await copyFile(path.join(libs, from), dest)
}
