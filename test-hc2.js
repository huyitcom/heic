import fs from 'fs/promises';
import convert from 'heic-convert';

async function test() {
  const inputBuffer = await fs.readFile('sample.heic');
  const outputBuffer = await convert({
    buffer: inputBuffer,
    format: 'JPEG',
    quality: 1
  });
  await fs.writeFile('sample-hc.jpg', outputBuffer);
  console.log('Converted sample-hc.jpg, size:', outputBuffer.length);
}
test().catch(console.error);
