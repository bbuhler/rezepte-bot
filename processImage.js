const Jimp = require('jimp');

const ratio = 16 / 9;
const titleImageWidth = 400;
const titleImageHeight = titleImageWidth / ratio;

module.exports = async function processImage(imgUrl, imgTmpName = 'temp.jpg')
{
  const image = await Jimp.read(imgUrl);
  const imageRatio = image.getWidth() / image.getHeight();

  // console.debug(image.getWidth(), image.getHeight(), imageRatio);

  let croppedImage;

  if (imageRatio <= ratio)
  {
    const resizedImage = image.resize(titleImageWidth, Jimp.AUTO);
    // console.debug(resizedImage.getWidth(), resizedImage.getHeight());

    croppedImage = await resizedImage.crop(0,(resizedImage.getHeight() - titleImageHeight) / 2, titleImageWidth, titleImageHeight);
  }
  else
  {
    const resizedImage = image.resize(Jimp.AUTO, titleImageHeight);
    // console.debug(resizedImage.getWidth(), resizedImage.getHeight());

    croppedImage = await resizedImage.crop((resizedImage.getWidth() - titleImageWidth) / 2,0, titleImageWidth, titleImageHeight);
  }

  await croppedImage.writeAsync(imgTmpName);
};
