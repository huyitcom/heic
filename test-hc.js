import fs from 'fs/promises';
import convert from 'heic-convert';

async function test() {
  const inputBuffer = await fs.readFile('IMG_0018.HEIC');
  const outputBuffer = await convert({
    buffer: inputBuffer, // the HEIC file buffer
    format: 'JPEG',      // output format
    quality: 1           // the jpeg compression quality, between 0 and 1
  });
  await fs.writeFile('test.jpg', outputBuffer);
  console.log('Converted test.jpg, size:', outputBuffer.length);
}
test().catch(console.error);
