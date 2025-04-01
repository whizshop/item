const TelegramBot = require('node-telegram-bot-api');
const { token } = require('./data.js');

// Initialize bot with faster polling
const bot = new TelegramBot(token, {
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10
    }
  }
});

// Configuration
const ADMIN_ID = 7612857358; // Your personal Telegram ID
const REQUIRED_CHANNEL = "@whiz_t";
const CHANNEL_LINK = `https://t.me/${REQUIRED_CHANNEL.slice(1)}`;
const RATE_LIMIT = { count: 3, window: 300000 }; // 3 requests per 5 minutes

// Emoji constants for better readability
const EMOJI = {
  SUCCESS: "✅",
  ERROR: "❌",
  WARNING: "⚠️",
  LOCK: "🔒",
  UNLOCK: "🔓",
  CLOCK: "⏳",
  MAGNIFY: "🔍",
  DOWNLOAD: "💾",
  ADMIN: "👑",
  CHANNEL: "📢",
  LOADING: "🔄"
};

// Storage with automatic cleanup
const userStates = new Map();
const rateLimits = new Map();

// Cleanup old rate limits every hour
setInterval(() => {
  const now = Date.now();
  for (const [userId, timestamps] of rateLimits) {
    const filtered = timestamps.filter(t => now - t < RATE_LIMIT.window);
    if (filtered.length > 0) {
      rateLimits.set(userId, filtered);
    } else {
      rateLimits.delete(userId);
    }
  }
}, 3600000);

// ======================
// 1. VERIFICATION SYSTEM
// ======================
async function verifyMembership(userId) {
  try {
    const member = await bot.getChatMember(REQUIRED_CHANNEL, userId);
    return ['member', 'administrator', 'creator'].includes(member.status);
  } catch (e) {
    console.error("Verification error:", e.message);
    return false;
  }
}

// ===================
// 2. CONTENT SAVER
// ===================
async function saveContent(userChatId, channelHandle, messageId) {
  try {
    // Step 1: Forward through admin account
    await bot.forwardMessage(ADMIN_ID, channelHandle, parseInt(messageId));
    
    // Step 2: Get the last forwarded message
    const updates = await bot.getUpdates({ limit: 1 });
    if (!updates.length) throw new Error("No forwarded message found");
    
    const forwardedMsg = updates[0].message;
    if (!forwardedMsg) throw new Error("Invalid forwarded message");
    
    // Step 3: Forward to user
    await bot.forwardMessage(userChatId, forwardedMsg.chat.id, forwardedMsg.message_id);
    
    return { success: true };
  } catch (error) {
    console.error("Save error:", error);
    return {
      success: false,
      message: error.response?.description || 
        "Failed to save content. The bot may need admin rights in that channel."
    };
  }
}

// ===================
// 3. MENU SYSTEM
// ===================
function showMainMenu(chatId) {
  return bot.sendMessage(chatId, `${EMOJI.MAGNIFY} *Content Saver Bot*`, {
    parse_mode: 'Markdown',
    reply_markup: {
      resize_keyboard: true,
      inline_keyboard: [
        [{
          text: `${EMOJI.DOWNLOAD} Save Content`,
          callback_data: "save_content"
        }],
        [{
          text: `${EMOJI.CHANNEL} Our Channel`,
          url: CHANNEL_LINK
        }],
        [{
          text: `${EMOJI.WARNING} Rate Limit Info`,
          callback_data: "rate_info"
        }]
      ]
    }
  });
}

// ===================
// 4. MESSAGE HANDLERS
// ===================
// Start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // Admin bypass
  if (userId === ADMIN_ID) {
    userStates.set(userId, { verified: true });
    return bot.sendMessage(chatId, `${EMOJI.ADMIN} *Admin Access Granted*`, {
      parse_mode: 'Markdown'
    });
  }

  // Check membership
  const isMember = await verifyMembership(userId);
  if (isMember) {
    userStates.set(userId, { verified: true });
    await bot.sendMessage(chatId, 
      `${EMOJI.SUCCESS} *Verification Complete!*\n\n` +
      `You can now save content from any Telegram channel.`,
      { parse_mode: 'Markdown' }
    );
    return showMainMenu(chatId);
  }

  // Not a member - show join prompt
  await bot.sendMessage(chatId,
    `${EMOJI.LOCK} *Membership Required*\n\n` +
    `To use this bot, please join our channel first:`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{
            text: `${EMOJI.CHANNEL} Join ${REQUIRED_CHANNEL}`,
            url: CHANNEL_LINK
          }],
          [{
            text: `${EMOJI.SUCCESS} I've Joined`,
            callback_data: "verify_join"
          }]
        ]
      }
    }
  );
});

// Callback queries
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;

  try {
    if (query.data === 'verify_join') {
      const isMember = await verifyMembership(userId);
      if (isMember) {
        userStates.set(userId, { verified: true });
        await bot.answerCallbackQuery(query.id, {
          text: "Verification successful!",
          show_alert: false
        });
        await bot.editMessageText(
          `${EMOJI.SUCCESS} *Access Granted!*\n\n` +
          `You can now save content from any Telegram channel.`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown'
          }
        );
        return showMainMenu(chatId);
      } else {
        await bot.answerCallbackQuery(query.id, {
          text: "You haven't joined the channel yet!",
          show_alert: true
        });
      }
    }
    else if (query.data === 'save_content') {
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId,
        `${EMOJI.MAGNIFY} *How to Save Content*\n\n` +
        `1. Find a message in any channel\n` +
        `2. Copy its link (tap ⋮ → Copy Link)\n` +
        `3. Paste it here\n\n` +
        `Example: \`https://t.me/channel/123\``,
        { parse_mode: 'Markdown' }
      );
    }
    else if (query.data === 'rate_info') {
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId,
        `${EMOJI.WARNING} *Rate Limit Info*\n\n` +
        `• ${RATE_LIMIT.count} saves per ${RATE_LIMIT.window/60000} minutes\n` +
        `• Resets automatically\n` +
        `• Admins have no limits`,
        { parse_mode: 'Markdown' }
      );
    }
  } catch (error) {
    console.error("Callback error:", error);
  }
});

// Handle Telegram links
bot.onText(/https?:\/\/t\.me\/(c\/)?([^/]+)\/(\d+)/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const [_, __, channelHandle, messageId] = match;

  // Verify membership
  if (!userStates.get(userId)?.verified) {
    return bot.sendMessage(chatId,
      `${EMOJI.LOCK} *Access Denied*\n\n` +
      `Please join ${REQUIRED_CHANNEL} and verify with /start`,
      { parse_mode: 'Markdown' }
    );
  }

  // Rate limiting (skip for admin)
  if (userId !== ADMIN_ID) {
    const now = Date.now();
    const recentRequests = (rateLimits.get(userId) || []).filter(t => now - t < RATE_LIMIT.window);
    
    if (recentRequests.length >= RATE_LIMIT.count) {
      const waitTime = Math.ceil((RATE_LIMIT.window - (now - recentRequests[0])) / 60000);
      return bot.sendMessage(chatId,
        `${EMOJI.CLOCK} *Slow Down!*\n\n` +
        `You've used all ${RATE_LIMIT.count} saves. Please wait ${waitTime} minute(s).`,
        { parse_mode: 'Markdown' }
      );
    }
  }

  // Processing animation
  const progressMsg = await bot.sendMessage(chatId,
    `${EMOJI.LOADING} *Processing Link*\n\n` +
    `0% ▰▱▱▱▱▱▱▱▱▱`,
    { parse_mode: 'Markdown' }
  );

  // Animated progress
  let progress = 0;
  const interval = setInterval(async () => {
    progress += 10;
    try {
      await bot.editMessageText(
        `${EMOJI.LOADING} *Processing Link*\n\n` +
        `${progress}% ${'▰'.repeat(progress/10)}${'▱'.repeat(10-progress/10)}`,
        {
          chat_id: chatId,
          message_id: progressMsg.message_id,
          parse_mode: 'Markdown'
        }
      );
    } catch (e) {}

    if (progress >= 100) {
      clearInterval(interval);
      const result = await saveContent(chatId, channelHandle, messageId);
      
      // Cleanup
      await bot.deleteMessage(chatId, progressMsg.message_id);
      
      if (result.success) {
        // Update rate limit
        if (userId !== ADMIN_ID) {
          const timestamps = rateLimits.get(userId) || [];
          rateLimits.set(userId, [...timestamps, Date.now()]);
        }
        
        await bot.sendMessage(chatId,
          `${EMOJI.SUCCESS} *Content Saved!*\n\n` +
          `Successfully retrieved from ${channelHandle}`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await bot.sendMessage(chatId,
          `${EMOJI.ERROR} *Failed to Save*\n\n` +
          `${result.message}\n\n` +
          `_Tip: The bot needs to be admin in the target channel_`,
          { parse_mode: 'Markdown' }
        );
      }
    }
  }, 500);
});

// Error handling
bot.on('polling_error', (error) => {
  console.error(`Polling error (${error.code}):`, error.message);
});

console.log(`${EMOJI.SUCCESS} Bot is running and ready!`);
