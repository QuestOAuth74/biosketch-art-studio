/**
 * Audio utilities for animation timeline audio sync.
 */

/**
 * Decode an audio file (mp3, wav, ogg, etc.) into an AudioBuffer.
 */
export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();
  const buffer = await audioContext.decodeAudioData(arrayBuffer);
  await audioContext.close();
  return buffer;
}

/**
 * Downsample an AudioBuffer into `numSamples` peak amplitude values (0–1 range).
 * Mixes all channels and takes absolute max per bucket.
 */
export function generateWaveformData(
  buffer: AudioBuffer,
  numSamples: number
): Float32Array {
  const result = new Float32Array(numSamples);
  const channelCount = buffer.numberOfChannels;
  const totalSamples = buffer.length;
  const bucketSize = totalSamples / numSamples;

  // Pre-fetch all channel data
  const channels: Float32Array[] = [];
  for (let c = 0; c < channelCount; c++) {
    channels.push(buffer.getChannelData(c));
  }

  for (let i = 0; i < numSamples; i++) {
    const start = Math.floor(i * bucketSize);
    const end = Math.min(Math.floor((i + 1) * bucketSize), totalSamples);
    let max = 0;

    for (let j = start; j < end; j++) {
      for (let c = 0; c < channelCount; c++) {
        const abs = Math.abs(channels[c][j]);
        if (abs > max) max = abs;
      }
    }

    result[i] = max;
  }

  return result;
}
