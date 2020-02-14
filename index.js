const Telegraf = require('telegraf');

const rezeptParser = require('./parser');
const processImage = require('./processImage');
const Trello = require('./trello');

const bot = new Telegraf(process.env.BOT_TOKEN);
const trello = new Trello(process.env.TRELLO_API_KEY, process.env.TRELLO_TOKEN);

const boardId = process.env.TRELLO_BOARD_ID;
const labelsPromise = trello.getBoardLabels(boardId);
const listsPromise = trello.getBoardLists(boardId);
const membersPromise = trello.getBoardMembers(boardId);

const emoji = {
  robot: '\u{1F916}\u{FE0F}',
  explosion: '\u{1F4A5}\u{FE0F}',
  sorry: '\u{1F625}\u{FE0F}',
  yummy: '\u{1F60B}\u{FE0F}',
  underConstruction: '\u{1F6A7}\u{FE0F}',
  peace: '\u{270C}\u{FE0F}',
};

bot.start(ctx =>
{
  const senderName = ctx.message.from.first_name;
  ctx.reply(`Hi ${senderName},\nschick mir nen Rezept-Link und ich füg's zu Ben's Rezepte Board hinzu! ${emoji.peace}`);
});

bot.hears(/https?\:\/\//, async ctx =>
{
  const { offset, length } = ctx.update.message.entities.find(entity => entity.type === 'url');
  const url = ctx.message.text.substr(offset, length);
  const senderName = ctx.message.from.first_name;

  console.log(url);

  ctx.replyWithChatAction('typing');

  try
  {
    const [firstList] = await listsPromise;
    const labels = await labelsPromise;
    const data = await rezeptParser(url, labels);

    if (data.image) await processImage(data.image, data.imageTempFile);

    const member = (await membersPromise).find(user => user.fullName.includes(senderName));
    if (member) data.member = member.id;

    const card = await trello.createCard(firstList.id, data);

    ctx.reply(`Hey ${senderName},\nich hab's in die "${firstList.name}" Liste eingetragen ${emoji.yummy}\n\n${card.url}`);
  }
  catch (err)
  {
    console.error(err);

    if (err instanceof rezeptParser.RequiresJavaScriptError)
    {
      ctx.reply(`Tut mir leid, ${emoji.sorry}\nich kann das Rezept unter dem Link (noch) nicht lesen. ${emoji.underConstruction}`);
    }
    else
    {
      ctx.reply(`${emoji.robot}${emoji.explosion} Kapuuuut.... Irgendwas ist schief gegangen.`);
    }
  }
});

bot.launch();
