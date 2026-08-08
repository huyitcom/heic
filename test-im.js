const { spawn } = require('child_process');

function convertHeicToJpg(buffer) {
  return new Promise((resolve, reject) => {
    const convert = spawn('convert', ['heic:-', '-quality', '80', 'jpeg:-']);
    const chunks = [];
    let errOutput = '';

    convert.stdout.on('data', (chunk) => chunks.push(chunk));
    convert.stderr.on('data', (chunk) => errOutput += chunk.toString());

    convert.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`ImageMagick exited with ${code}: ${errOutput}`));
      }
    });

    convert.stdin.write(buffer);
    convert.stdin.end();
  });
}
console.log('Script created');
