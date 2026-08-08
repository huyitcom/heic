const sharp = require('sharp');
process.env.LIBHEIF_SECURITY_LIMITS = 'off';
sharp('sample.heic', { unlimited: true })
  .jpeg()
  .toFile('sample-sharp.jpg')
  .then(i => console.log('sharp size:', i.size))
  .catch(console.error);
