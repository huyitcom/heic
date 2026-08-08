import fs from 'fs/promises';
import heicDecode from 'heic-decode';

async function test() {
  const inputBuffer = await fs.readFile('IMG_0018.HEIC');
  const images = await heicDecode.all({ buffer: inputBuffer });
  console.log('Number of images:', images.length);
  for (let i = 0; i < images.length; i++) {
    console.log(`Image ${i}: ${images[i].width}x${images[i].height}`);
  }
}
test().catch(console.error);
