const { JSDOM } = require('jsdom');
const iso8601 = require('iso8601-duration');

const isVegan = str => /vegan/i.test(str);
const isHauptgericht = str => /haupt(gericht|speise)/i.test(str);
const isDessert = str => /dessert|nachtisch/i.test(str);
const isSnack = str => /snacks?/i.test(str);
const isSchnell = str => /schnell|fast|quick?/i.test(str);

const parseDuration = str => iso8601.toSeconds(iso8601.parse(str)) / 60;

class RequiresJavaScriptError extends Error {}
class RetryWithGoogleCacheError extends Error {}

module.exports = async function rezeptParser(url, labels = [], forceGoogleCache = false)
{
  let dom;

  try
  {
    if (forceGoogleCache)
    {
      throw new RetryWithGoogleCacheError();
    }

    dom = await JSDOM.fromURL(url);
  }
  catch (err)
  {
    if (!/getaddrinfo ENOTFOUND/.test(err.message) && ![404, 403].includes(err.statusCode) && !err instanceof RetryWithGoogleCacheError)
    {
      throw err;
    }

    console.warn(err.message);
    console.log('Try again using Google Cache...');

    dom = await JSDOM.fromURL(`https://webcache.googleusercontent.com/search?q=cache:${url}`);
  }

  const { document } = dom.window;

  function getRecipeLinkingData()
  {
    const ldJsonScriptTags = document.querySelectorAll('script[type="application/ld+json"]');

    for (const ldJsonScriptTag of ldJsonScriptTags)
    {
      const ldJson = JSON.parse(ldJsonScriptTag.textContent);

      if (Array.isArray(ldJson['@graph'] || ldJson))
      {
        for (const ldJsonEntry of ldJson['@graph'] || ldJson)
        {
          if (ldJsonEntry['@type'] === 'Recipe')
          {
            return ldJsonEntry;
          }
        }
      }

      if (ldJson['@type'] === 'Recipe')
      {
        return ldJson;
      }
    }

    return {};
  }

  function meta(property)
  {
    const metaTag = document.querySelector(`meta[property="${property}"]`);

    if (metaTag)
    {
      return metaTag.getAttribute('content');
    }
  }

  function metas(property)
  {
    const metaTags = document.querySelectorAll(`meta[property="${property}"]`);

    if (metaTags.length)
    {
      return Array.from(metaTags).map(node => node.getAttribute('content'));
    }

    return [];
  }

  function firstImage(selector = 'main')
  {
    const imgTag = document.querySelector(`${selector} img`);

    if (imgTag && !imgTag.closest('aside') && !imgTag.src.startsWith('data:'))
    {
      return imgTag.src;
    }
  }

  const linkingData = getRecipeLinkingData();
  const result = {
    title: linkingData.name || meta('og:title') || document.title,
    image: (Array.isArray(linkingData.image) ? linkingData.image[0] : linkingData.image) || meta('og:image') || firstImage('article') || firstImage('main'),
    imageTempFile: undefined,
    url: meta('og:url') || url,
    tags: [],
  };

  if (document.querySelector('noscript') && !Object.keys(linkingData).length && !meta('og:title'))
  {
    if (!forceGoogleCache)
    {
      return rezeptParser(url, labels, true);
    }

    throw new RequiresJavaScriptError();
  }

  const category = check => check(linkingData.recipeCategory) ||
    metas('article:tag').some(check) ||
    Array.isArray(linkingData.recipeCategory) && linkingData.recipeCategory.some(check);

  if (category(isHauptgericht))
  {
    result.tags.push('Hauptgericht');
  }

  if (category(isDessert))
  {
    result.tags.push('Dessert');
  }

  if (category(isSnack))
  {
    result.tags.push('Snack');
  }

  if (category(isSchnell) || linkingData.totalTime && parseDuration(linkingData.totalTime) <= 30)
  {
    result.tags.push('Schnell');
  }

  if (category(isVegan) || isVegan(linkingData.suitableForDiet) || isVegan(meta('og:title')) || isVegan(meta('og:description')) || isVegan(document.title))
  {
    result.tags.push('Vegan');
  }

  if (result.image)
  {
    result.imageTempFile = `/tmp/${result.title.replace(/\s/g, '-').replace(/[^A-Za-zÄÖÜäöüß-]/g, '')}.jpg`;
  }

  const labelIds = result.tags.map(tag => {
    const found = labels.find(label => label.name === tag);
    if (found) return found.id;
    else console.warn('Unknown tag:', tag)
  });

  result.tags = labelIds.filter(Boolean).join();

  return result;
};

module.exports.RequiresJavaScriptError = RequiresJavaScriptError;
