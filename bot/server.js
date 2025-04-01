const TelegramBot = require('node-telegram-bot-api');
const { token, adminId, requiredChannel } = require('./data.js');
const bot = new TelegramBot(token, { polling: true });

// Rate limit storage: { userId: [timestamp1, timestamp2] }
const rateLimits = new Map();

// Verify channel membership
async function checkMembership(userId) {
  try {
    const member = await bot.getChatMember(requiredChannel, userId);
    return ['member', 'administrator', 'creator'].includes(member.status);
  } catch (e) {
    console.error("Verification error:", e);
    return false;
  }
}

// Start command with verification
bot.onText(/\/start/, async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  await bot.sendMessage(chatId, `🔒 *Access Required*`, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { 
          text: "🌟 Join @whiz_t", 
          url: `https://t.me/${requiredChannel.slice(1)}` 
        },
        { 
          text: "✅ Verify Join", 
          callback_data: "verify_join" 
        }
      ]]
    }
  });
});

// Handle verification button
bot.on('callback_query', async (query) => {
  if (query.data === 'verify_join') {
    const isMember = await checkMembership(query.from.id);
    
    if (isMember) {
      await bot.answerCallbackQuery(query.id, { text: "Access granted!" });
      await bot.sendMessage(query.message.chat.id, 
        "🎉 You can now use the bot!\n\n" +
        "Simply send any Telegram message link.\n\n" +
        "⚠️ *Rate limit:* 3 saves per 5 minutes",
        { parse_mode: 'Markdown' }
      );
    } else {
      await bot.answerCallbackQuery(query.id, { 
        text: "You haven't joined the channel!", 
        show_alert: true 
      });
    }
  }
});

// Content saving logic
bot.onText(/https?:\/\/t\.me\/(c\/)?([^/]+)\/(\d+)/i, async (msg, match) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  
  // Verify membership
  if (!(await checkMembership(userId))) {
    return bot.sendMessage(chatId, "❌ Please join @whiz_t first using /start");
  }

  // Rate limiting
  const now = Date.now();
  const userTimestamps = rateLimits.get(userId) || [];
  const recentRequests = userTimestamps.filter(t => now - t < 300000); // 5 minutes

  if (recentRequests.length >= 3) {
    const waitTime = Math.ceil((300000 - (now - recentRequests[0])) / 60000);
    return bot.sendMessage(chatId, 
      `⚠️ *Rate Limit Exceeded*\n\nPlease wait ${waitTime} minute(s) before saving more content.`,
      { parse_mode: 'Markdown' }
    );
  }

  const [_, __, channelHandle, messageId] = match;
  
  // Loading animation
  const progressMessage = await bot.sendMessage(
    chatId,
    `⏳ Processing link...\n0% ▰▱▱▱▱▱▱▱▱▱`,
    { disable_web_page_preview: true }
  );

  // Update progress every second
  let progress = 0;
  const interval = setInterval(async () => {
    progress += 10;
    try {
      await bot.editMessageText(
        `⏳ Processing link...\n${progress}% ${'▰'.repeat(progress/10)}${'▱'.repeat(10-progress/10)}`,
        {
          chat_id: chatId,
          message_id: progressMessage.message_id,
          disable_web_page_preview: true
        }
      );
    } catch (e) {}

    if (progress >= 100) {
      clearInterval(interval);
      await finalizeSave(chatId, userId, channelHandle, messageId, progressMessage.message_id);
    }
  }, 500);
});

async function finalizeSave(chatId, userId, channelHandle, messageId, progressMsgId) {
  try {
    // Admin bypass (forward to you first)
    await bot.forwardMessage(adminId, channelHandle, parseInt(messageId));
    
    // Forward to user
    await bot.forwardMessage(chatId, channelHandle, parseInt(messageId));
    
    // Update rate limit
    const timestamps = rateLimits.get(userId) || [];
    rateLimits.set(userId, [...timestamps, Date.now()]);
    
    // Cleanup
    await bot.deleteMessage(chatId, progressMsgId);
    await bot.sendMessage(chatId, `✅ Content saved from ${channelHandle}`);
    
  } catch (error) {
    console.error("Save error:", error);
    await bot.editMessageText(
      `❌ Failed to save content:\n${error.message}`,
      { chat_id: chatId, message_id: progressMsgId }
    );
  }
}

// Error handling
bot.on('polling_error', console.error);
