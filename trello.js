const { createReadStream } = require('fs');
const requestPromise = require('request-promise-native');

module.exports = class Trello
{
  constructor(key, token)
  {
    this.request = requestPromise.defaults
    ({
      baseUrl: 'https://api.trello.com/1/',
      gzip: true,
      followAllRedirects: true,
      qs: { key, token },
      json: true,
    });
  }

  getBoardLists(boardId)
  {
    return this.request.get(`board/${boardId}/lists`);
  }

  getBoardLabels(boardId)
  {
    return this.request.get(`board/${boardId}/labels?fields=name`);
  }

  createCard(listId, { title, imageTempFile, url, tags })
  {
    const formData = {
      name: title,
      desc: url,
      fileSource: createReadStream(imageTempFile),
      idLabels: tags,
    };

    return this.request.post({ url: 'cards', qs: { idList: listId }, formData });
  }
};
