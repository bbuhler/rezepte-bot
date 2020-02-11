const { JSDOM } = require('jsdom');

const isVegan = str => /vegan/i.test(str);
const isHauptgericht = str => /hauptgericht/i.test(str);

class RequiresJavaScriptError extends Error {}

module.exports = async function rezeptParser(url, labels = [])
{
  const dom = await JSDOM.fromURL(url);
  const { head } = dom.window.document;

  function getRecipeLinkingData()
  {
    const ldJsonScriptTags = dom.window.document.querySelectorAll('script[type="application/ld+json"]');

    for (const ldJsonScriptTag of ldJsonScriptTags)
    {
      const ldJson = JSON.parse(ldJsonScriptTag.textContent);

      if (Array.isArray(ldJson['@graph']))
      {
        for (const ldJsonEntry of ldJson['@graph'])
        {
          if (ldJsonEntry['@type'] === '')
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
    const metaTag = head.querySelector(`meta[property="${property}"]`);

    if (metaTag)
    {
      return metaTag.getAttribute('content');
    }
  }

  function metas(property)
  {
    const metaTags = head.querySelectorAll(`meta[property="${property}"]`);

    if (metaTags.length)
    {
      return Array.from(metaTags).map(node => node.getAttribute('content'));
    }

    return [];
  }

  function firstImage(selector = 'main')
  {
    const imgTag = dom.window.document.querySelector(`${selector} img`);
    if (imgTag) return imgTag.src;
  }

  const linkingData = getRecipeLinkingData();
  const result = {
    title: linkingData.name || meta('og:title') || dom.window.document.title,
    image: (Array.isArray(linkingData.image) ? linkingData.image[0] : linkingData.image) || meta('og:image') || firstImage('article') || firstImage('main'),
    imageTempFile: undefined,
    url: meta('og:url') || url,
    tags: [],
  };

  if (dom.window.document.querySelector('noscript') && !Object.keys(linkingData).length && !meta('og:title'))
  {
    // TODO implement JSDOM with runScripts: "dangerously"
    throw new RequiresJavaScriptError();
  }

  if (isHauptgericht(linkingData.recipeCategory) || metas('article:tag').some(isHauptgericht) || Array.isArray(linkingData.recipeCategory) && linkingData.recipeCategory.some(isHauptgericht))
  {
    result.tags.push('Hauptgericht');
  }

  if (isVegan(linkingData.suitableForDiet) || metas('article:tag').some(isVegan) || isVegan(meta('og:title')) || isVegan(meta('og:description')) || isVegan(dom.window.document.title))
  {
    result.tags.push('Vegan');
  }

  result.imageTempFile = `/tmp/${result.title.replace(/\s/g, '-').replace(/[^A-Za-zÄÖÜäöüß-]/g, '')}.jpg`;

  result.tags = result.tags.map(tag => labels.find(label => label.name === tag).id).join();

  return result;
};

module.exports.RequiresJavaScriptError = RequiresJavaScriptError;
