'use server'

import { getUserTier } from '@/lib/auth/user-tier'
import { getRedisClient, RedisWrapper } from '@/lib/redis/config'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { type Chat, ExtendedCoreMessage } from '@/lib/types'
import { CoreMessage, JSONValue } from 'ai'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function getRedis(): Promise<RedisWrapper> {
  return await getRedisClient()
}

const CHAT_VERSION = 'v2'
function getUserChatKey(userId: string) {
  return `user:${CHAT_VERSION}:chat:${userId}`
}

export async function getChats(userId?: string | null) {
  if (!userId) {
    return []
  }

  try {
    const redis = await getRedis()
    const chats = await redis.zrange(getUserChatKey(userId), 0, -1, {
      rev: true
    })

    if (chats.length === 0) {
      return []
    }

    const results = await Promise.all(
      chats
        .filter((chatKey): chatKey is string => typeof chatKey === 'string' && chatKey !== null)
        .map(async chatKey => {
          const chat = await redis.hgetall(chatKey)
          return chat
        })
    )

    return results
      .filter((result): result is Record<string, any> => {
        if (result === null || Object.keys(result).length === 0) {
          return false
        }
        return true
      })
      .map(chat => {
        const plainChat = { ...chat }
        if (typeof plainChat.messages === 'string') {
          try {
            plainChat.messages = JSON.parse(plainChat.messages)
          } catch (error) {
            plainChat.messages = []
          }
        }
        if (plainChat.createdAt && !(plainChat.createdAt instanceof Date)) {
          plainChat.createdAt = new Date(plainChat.createdAt)
        }
        return plainChat as Chat
      })
  } catch (error) {
    return []
  }
}

export async function getChatsPage(
  userId: string,
  limit = 20,
  offset = 0
): Promise<{ chats: Chat[]; nextOffset: number | null }> {
  console.log('[getChatsPage] Called with userId:', userId, 'limit:', limit, 'offset:', offset);
  try {
    const supabase = await createSupabaseClient();
    const redis = await getRedis();

    // 1. Fetch paginated conversation metadata from Supabase
    console.log('[getChatsPage] Fetching conversations metadata from Supabase for userId:', userId);
    const { data: conversationsMeta, error: convListError } = await supabase
      .from('conversations')
      .select('id, title, created_at, user_id, path, share_path') // Select necessary fields
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (convListError) {
      console.error('[getChatsPage] Error fetching conversations metadata from Supabase:', convListError);
      return { chats: [], nextOffset: null };
    }
    console.log('[getChatsPage] Fetched conversationsMeta count:', conversationsMeta?.length ?? 0);

    if (!conversationsMeta || conversationsMeta.length === 0) {
      console.log('[getChatsPage] No conversations metadata found for userId:', userId);
      return { chats: [], nextOffset: null };
    }

    const conversationIds = conversationsMeta.map(c => c.id);
    let resolvedChats: Chat[] = [];
    const chatsToFetchFromDbMetas: typeof conversationsMeta = [];

    // 2. Attempt to fetch full chat details from Redis cache
    console.log('[getChatsPage] Attempting to fetch', conversationIds.length, 'chats from Redis cache.');
    const redisPipeline = redis.pipeline();
    conversationIds.forEach(id => redisPipeline.hgetall(`chat:${id}`));
    const cachedChatsData = await redisPipeline.exec() as ([Error | null, Record<string, string> | null][]);

    for (let i = 0; i < conversationsMeta.length; i++) {
      const meta = conversationsMeta[i];
      const cacheResult = cachedChatsData[i];
      // cacheResult is an array: [error, data]
      if (cacheResult && cacheResult[1] && Object.keys(cacheResult[1]).length > 0) {
        const chatFromCacheData = cacheResult[1];
        console.log('[getChatsPage] Cache hit for chat ID:', meta.id);
        const chat: Partial<Chat> = {};
        Object.keys(chatFromCacheData).forEach(key => {
          (chat as any)[key] = (chatFromCacheData as any)[key];
        });

        if (typeof chat.messages === 'string') {
          try {
            chat.messages = JSON.parse(chat.messages) as ExtendedCoreMessage[];
          } catch (e) {
            console.error('[getChatsPage] Error parsing messages from cache for chat ID:', meta.id, e);
            chat.messages = [];
          }
        }
        if (chat.createdAt && !(chat.createdAt instanceof Date)) {
          chat.createdAt = new Date(chat.createdAt as string);
        }
        resolvedChats.push(chat as Chat);
      } else {
        console.log('[getChatsPage] Cache miss for chat ID:', meta.id);
        chatsToFetchFromDbMetas.push(meta);
      }
    }
    console.log('[getChatsPage] Fetched', resolvedChats.length, 'chats from cache.', chatsToFetchFromDbMetas.length, 'chats to fetch from DB.');

    // 3. Fetch remaining chats (cache misses) from Supabase
    if (chatsToFetchFromDbMetas.length > 0) {
      const idsToFetchFromDb = chatsToFetchFromDbMetas.map(meta => meta.id);
      console.log('[getChatsPage] Fetching messages for', idsToFetchFromDb.length, 'conversations from Supabase.');
      
      const { data: messagesData, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .in('conversation_id', idsToFetchFromDb)
        .order('created_at', { ascending: true });

      if (msgError) {
        console.error('[getChatsPage] Error fetching messages from Supabase:', msgError);
        // We might still proceed with chats found in cache, or return error
        // For now, continue and those chats won't have messages
      }
      console.log('[getChatsPage] Fetched', messagesData?.length ?? 0, 'messages from Supabase.');

      const messagesByConvId = (messagesData || []).reduce<Record<string, any[]>>((acc, msg) => {
        const convId = msg.conversation_id;
        if (!acc[convId]) acc[convId] = [];
        acc[convId].push(msg);
        return acc;
      }, {});

      const newChatsToCachePipeline = redis.pipeline();
      for (const meta of chatsToFetchFromDbMetas) {
        const conversationMessages = messagesByConvId[meta.id] || [];
        const reconstructedMessages: ExtendedCoreMessage[] = conversationMessages.map(msg => {
          let content: CoreMessage['content'] | JSONValue = msg.content;
          try {
            if (typeof msg.content === 'string' && (msg.content.startsWith('{') || msg.content.startsWith('['))) {
              content = JSON.parse(msg.content);
            }
          } catch (e) { /* keep content as string if parsing fails */ }
          return {
            role: msg.role as CoreMessage['role'] | 'data',
            content: content,
            // Ensure other ExtendedCoreMessage fields are mapped if necessary
            // id: msg.id, // if your messages have IDs and they are part of ExtendedCoreMessage
            // name: msg.name, // if applicable
            // tool_calls: msg.tool_calls, // if applicable
            // tool_call_id: msg.tool_call_id, // if applicable
          };
        });

        const chatFromDb: Chat = {
          id: meta.id,
          title: meta.title,
          createdAt: new Date(meta.created_at),
          userId: meta.user_id,
          path: meta.path,
          messages: reconstructedMessages,
          sharePath: meta.share_path || undefined, // Ensure type consistency
        };
        resolvedChats.push(chatFromDb);
        console.log('[getChatsPage] Reconstructed chat from DB:', chatFromDb.id);

        const chatToCache = {
          ...chatFromDb,
          messages: JSON.stringify(chatFromDb.messages), // Stringify messages for Redis
        };
        newChatsToCachePipeline.hmset(`chat:${chatFromDb.id}`, chatToCache);
      }

      if (chatsToFetchFromDbMetas.length > 0) {
        console.log('[getChatsPage] Attempting to cache', chatsToFetchFromDbMetas.length, 'newly fetched chats to Redis.');
        try {
          await newChatsToCachePipeline.exec();
          console.log('[getChatsPage] Successfully cached newly fetched chats.');
        } catch (cacheError) {
          console.error('[getChatsPage] Error caching newly fetched chats to Redis:', cacheError);
        }
      }
    }

    // 4. Sort all resolved chats by createdAt date, as they might be mixed from cache and DB
    resolvedChats.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // 5. Determine nextOffset
    const nextOffset = conversationsMeta.length === limit ? offset + limit : null;
    console.log('[getChatsPage] nextOffset:', nextOffset, 'Returning', resolvedChats.length, 'chats.');

    return { chats: resolvedChats, nextOffset };
  } catch (error) {
    console.error('[getChatsPage] Unexpected error in getChatsPage:', error);
    // It's important to see if this top-level catch is ever hit, or if errors are caught by Supabase/Redis clients
    // and handled (e.g. returning null or empty arrays) before this point.
    // A 429 would typically be an error on the HTTP response from Supabase/Redis, not an exception caught here,
    // unless the client library throws an exception for it.
    return { chats: [], nextOffset: null };
  }
}

export async function getChat(id: string, userId: string) {
  console.log('[getChat] Called with id:', id, 'userId:', userId);
  if (id === null || typeof id === 'undefined') {
    console.error('[getChat] CRITICAL: getChat called with null or undefined id. Returning null. UserId:', userId);
    return null;
  }

  const redis = await getRedis() // Keep Redis for cache access
  const cacheKey = `chat:${id}`;
  console.log('[getChat] Attempting to fetch from cache with key:', cacheKey);
  let chatFromCache = await redis.hgetall<Chat>(cacheKey)
  console.log('[getChat] Result from cache for key', cacheKey, ':', chatFromCache ? 'Found' : 'Not Found', chatFromCache ? Object.keys(chatFromCache).length : '');


  if (chatFromCache && Object.keys(chatFromCache).length > 0) {
    console.log('[getChat] Cache hit for id:', id);
    // Cache hit
    if (typeof chatFromCache.messages === 'string') {
      try {
        chatFromCache.messages = JSON.parse(chatFromCache.messages)
      } catch (error) {
        console.error('Error parsing messages from cache:', error)
        chatFromCache.messages = []
      }
    }
    if (!Array.isArray(chatFromCache.messages)) {
      chatFromCache.messages = []
    }
    // Ensure createdAt is a Date object if it's coming from Redis potentially as string
    if (chatFromCache.createdAt && !(chatFromCache.createdAt instanceof Date)) {
        chatFromCache.createdAt = new Date(chatFromCache.createdAt);
    }
    return chatFromCache
  }

  console.log('[getChat] Cache miss for id:', id, '. Fetching from Supabase.');
  // Cache miss, fetch from Supabase
  const supabase = await createSupabaseClient()

  console.log('[getChat] Supabase: Fetching conversation with id:', id);
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (convError) {
    console.error(`[getChat] Supabase: Error fetching conversation ${id} from Supabase:`, convError);
    return null
  }
  if (!conversation) {
    console.log('[getChat] Supabase: Conversation not found for id:', id);
    return null // Not found in Supabase
  }
  console.log('[getChat] Supabase: Fetched conversation for id:', id, conversation);

  console.log('[getChat] Supabase: Fetching messages for conversation_id:', id);
  const { data: messagesData, error: msgError } = await supabase
    .from('messages')
    .select('*') // Select all fields to reconstruct ExtendedCoreMessage
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  if (msgError) {
    console.error(`[getChat] Supabase: Error fetching messages for chat ${id} from Supabase:`, msgError);
    // Decide if partial chat (conversation only) should be returned or null
    return null
  }
  console.log('[getChat] Supabase: Fetched messagesData for id:', id, messagesData ? messagesData.length : 0, 'messages');

  // Reconstruct the Chat object from Supabase data
  const messages: ExtendedCoreMessage[] = messagesData
    ? messagesData.map(msg => {
        let content: CoreMessage['content'] | JSONValue = msg.content
        try {
          // Attempt to parse content if it looks like JSON and messages.content is TEXT in DB
          if (typeof msg.content === 'string' && (msg.content.startsWith('{') || msg.content.startsWith('['))) {
            content = JSON.parse(msg.content)
          }
        } catch (e) {
          // Keep content as string if parsing fails
        }
        return {
          role: msg.role as CoreMessage['role'] | 'data',
          content: content,
          // Map other fields from msg to ExtendedCoreMessage if necessary
          // (e.g., name, tool_calls, tool_call_id based on CoreMessage structure)
        }
      })
    : []

  const chatFromDb: Chat = {
    id: conversation.id,
    title: conversation.title,
    createdAt: new Date(conversation.created_at),
    userId: conversation.user_id,
    path: conversation.path,
    messages: messages,
    sharePath: conversation.share_path || null
  }
  console.log('[getChat] Constructed chatFromDb for id:', id, chatFromDb);

  // Populate Upstash cache
  const chatToCache = {
    ...chatFromDb,
    messages: JSON.stringify(chatFromDb.messages) // Stringify messages for Redis
  }
  const cacheStoreKey = `chat:${chatFromDb.id}`;
  console.log('[getChat] Attempting to populate cache for key:', cacheStoreKey, 'with data:', chatToCache);
  try {
    await redis.hmset(cacheStoreKey, chatToCache);
    console.log('[getChat] Successfully populated cache for key:', cacheStoreKey);
  } catch (cacheError) {
    console.error('[getChat] Error populating cache for key:', cacheStoreKey, 'Error:', cacheError);
    // Decide if we should still return chatFromDb or throw/return null
  }
  // Also consider adding to the user's sorted set in Redis if getChat is authoritative for new chats
  // However, saveChat is primarily responsible for the sorted set.

  return chatFromDb
}

export async function clearChats(
  userId: string
): Promise<{ error?: string }> {
  const supabase = await createSupabaseClient() // Instantiate Supabase client

  // 1. Delete from Supabase
  try {
    // Fetch all conversation IDs for the user
    const { data: userConversations, error: fetchConvError } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId)

    if (fetchConvError) {
      console.error(`Error fetching conversations for user ${userId} from Supabase:`, fetchConvError)
      return { error: 'Failed to fetch user conversations for deletion' }
    }

    if (userConversations && userConversations.length > 0) {
      const conversationIdsToDelete = userConversations.map(conv => conv.id)

      // Delete associated messages for these conversations
      const { error: msgDelError } = await supabase
        .from('messages')
        .delete()
        .in('conversation_id', conversationIdsToDelete)

      if (msgDelError) {
        console.error(`Error deleting messages for user ${userId} from Supabase:`, msgDelError)
        return { error: 'Failed to delete user messages from database' }
      }

      // Delete the conversations themselves
      const { error: convDelError } = await supabase
        .from('conversations')
        .delete()
        .eq('user_id', userId)

      if (convDelError) {
        console.error(`Error deleting conversations for user ${userId} from Supabase:`, convDelError)
        return { error: 'Failed to delete user conversations from database' }
      }
    } // else: no conversations to delete in Supabase for this user

  } catch (dbError) {
    console.error(`Database error during clearChats for user ${userId}:`, dbError)
    return { error: 'A database error occurred while clearing chats' }
  }

  // 2. Delete from Upstash (existing logic)
  const redis = await getRedis()
  const userChatKey = getUserChatKey(userId)
  const chats = await redis.zrange(userChatKey, 0, -1)
  if (!chats.length) {
    return { error: 'No chats to clear' }
  }
  const pipeline = redis.pipeline()

  for (const chat of chats) {
    if (chat !== null && typeof chat === 'string') {
      pipeline.del(chat)
      pipeline.zrem(userChatKey, chat)
    }
  }

  await pipeline.exec()

  revalidatePath('/')
  redirect('/')
}

export async function deleteChat(
  chatId: string,
  userId: string
): Promise<{ error?: string }> {
  try {
    const supabase = await createSupabaseClient() // Instantiate Supabase client

    // 1. Delete from Supabase
    // Option A: Explicitly delete messages first (safer if cascade is not guaranteed or for clarity)
    const { error: msgDelError } = await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', chatId)
      // .eq('user_id', userId) // If RLS on messages table is not solely based on conversation_id linkage

    if (msgDelError) {
      console.error(`Error deleting messages for chat ${chatId} from Supabase:`, msgDelError)
      return { error: 'Failed to delete chat messages from database' }
    }

    const { error: convDelError } = await supabase
      .from('conversations')
      .delete()
      .eq('id', chatId)
      .eq('user_id', userId) // Ensure user can only delete their own

    if (convDelError) {
      console.error(`Error deleting conversation ${chatId} from Supabase:`, convDelError)
      return { error: 'Failed to delete chat from database' }
    }

    // 2. Delete from Upstash (existing logic)
    const redis = await getRedis()
    const userKey = getUserChatKey(userId)
    const chatKey = `chat:${chatId}`
    console.log(`[deleteChat] Called for chatId: ${chatId}, userId: ${userId}. Effective chatKey: ${chatKey}, userKey: ${userKey}`);

    const chatDetails = await redis.hgetall<Chat>(chatKey)
    if (!chatDetails || Object.keys(chatDetails).length === 0) {
      console.warn(`[deleteChat] Chat details not found in Redis cache (hgetall check) for chatKey: ${chatKey}. UserKey: ${userKey}. Will still attempt deletion from sorted set and Supabase.`)
    } else {
      console.log(`[deleteChat] Chat details found in Redis cache for chatKey: ${chatKey}. Proceeding with full deletion.`);
    }

    console.log(`[deleteChat] Attempting Redis pipeline: DEL ${chatKey}, ZREM ${userKey} ${chatKey}`);
    const pipeline = redis.pipeline()
    pipeline.del(chatKey)
    pipeline.zrem(userKey, chatKey) // Use chatKey consistently
    await pipeline.exec()

    // Revalidate the root path where the chat history is displayed
    revalidatePath('/')

    return {}
  } catch (error) {
    console.error(`Error deleting chat ${chatId}:`, error)
    return { error: 'Failed to delete chat' }
  }
}

export async function saveChat(chat: Chat, userId: string) {
  try {
    const userTier = await getUserTier(userId)

    if (userTier === 'free' || userTier === 'pro') {
      // Only persist to Supabase for 'free' or 'pro' users
      const supabase = await createSupabaseClient()

      // 1. Save to Supabase
      // Upsert conversation
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .upsert({
          id: chat.id,
          user_id: userId,
          title: chat.title,
          path: chat.path,
          created_at: new Date(chat.createdAt).toISOString(),
          updated_at: new Date().toISOString(),
          share_path: chat.sharePath
        })
        .select()

      if (convError) {
        console.error('Supabase error saving conversation:', convError)
        throw convError
      }

      // Insert messages
      if (chat.messages && chat.messages.length > 0) {
        const messagesToInsert = chat.messages.map(message => {
          const messageContent = typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
          
          let tokens = 0; // Default to 0
          if ('tokens' in message && typeof message.tokens === 'number') {
              tokens = message.tokens;
          }

          return {
            conversation_id: chat.id,
            user_id: userId,
            role: message.role,
            content: messageContent,
            tokens: tokens,
            created_at: new Date().toISOString()
          }
        })

        const { error: msgError } = await supabase
          .from('messages')
          .insert(messagesToInsert)

        if (msgError) {
          console.error('Supabase error saving messages:', msgError)
          throw msgError
        }
      }
    } // End of Supabase persistence block for non-guest users

    // For ALL users (guests, free, pro), save to Upstash for caching during the session
    const redis = await getRedis()
    const pipeline = redis.pipeline()

    const chatToSave = {
      ...chat,
      messages: JSON.stringify(chat.messages)
    }

    pipeline.hmset(`chat:${chat.id}`, chatToSave)
    pipeline.zadd(getUserChatKey(userId), Date.now(), `chat:${chat.id}`)

    if (userTier === 'guest') {
      const GUEST_CHAT_TTL_SECONDS = 24 * 60 * 60 // 24 hours in seconds
      pipeline.expire(`chat:${chat.id}`, GUEST_CHAT_TTL_SECONDS)
      pipeline.expire(getUserChatKey(userId), GUEST_CHAT_TTL_SECONDS)
    }

    const results = await pipeline.exec()

    return results
  } catch (error) {
    throw error
  }
}

export async function getSharedChat(id: string) {
  const redis = await getRedis()
  const chat = await redis.hgetall<Chat>(`chat:${id}`)

  if (!chat || !chat.sharePath) {
    return null
  }

  return chat
}

export async function shareChat(id: string, userId: string): Promise<Chat | null> {
  const userTier = await getUserTier(userId)
  const supabase = await createSupabaseClient()
  const redis = await getRedis()
  const sharePathValue = `/share/${id}`

  if (userTier === 'unknown') {
    console.error(`Cannot share chat for user ${userId} with unknown tier.`);
    return null;
  }

  // --- Helper function to construct Chat object for return ---
  // (This is a simplified version, assumes messages are already in ExtendedCoreMessage format)
  const constructChatObject = (conversationData: any, messages: ExtendedCoreMessage[]): Chat => {
    return {
      id: conversationData.id,
      title: conversationData.title,
      createdAt: new Date(conversationData.created_at),
      userId: conversationData.user_id,
      path: conversationData.path,
      messages: messages,
      sharePath: conversationData.share_path || undefined
    };
  };
  
  // --- Helper function to update cache ---
  const updateCacheWithSharePath = async (chatId: string, chatData: Chat) => {
    const chatDataForRedis: Record<string, any> = {
      ...chatData,
      createdAt: new Date(chatData.createdAt).toISOString(),
      messages: JSON.stringify(chatData.messages), // Ensure messages are stringified for Redis
      sharePath: sharePathValue // Ensure this is set
    };
    await redis.hmset(`chat:${chatId}`, chatDataForRedis);
  };


  if (userTier === 'free' || userTier === 'pro') {
    // Logic for registered (free/pro) users: update existing record in Supabase
    const { data: updatedConversation, error: dbError } = await supabase
      .from('conversations')
      .update({
        share_path: sharePathValue,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (dbError || !updatedConversation) {
      console.error(`Supabase error updating share_path for ${userTier} user ${userId}, chat ${id}:`, dbError);
      return null;
    }

    // For registered users, messages are already persisted. Fetch from cache to update sharePath.
    const chatFromCache = await redis.hgetall<Chat>(`chat:${id}`);
    let messagesForReturn: ExtendedCoreMessage[] = [];
    if (chatFromCache && chatFromCache.messages) {
      messagesForReturn = typeof chatFromCache.messages === 'string' ? JSON.parse(chatFromCache.messages) : chatFromCache.messages;
    } else {
      // If not in cache, or messages missing, fetch from DB to ensure we have them for the return object and cache update
      const { data: dbMessages } = await supabase.from('messages').select('*').eq('conversation_id', id).order('created_at');
      if (dbMessages) {
        messagesForReturn = dbMessages.map(msg => ({
            role: msg.role as CoreMessage['role'] | 'data',
            content: typeof msg.content === 'string' && (msg.content.startsWith('{') || msg.content.startsWith('[')) ? JSON.parse(msg.content) : msg.content
        }));
      }
    }
    
    const chatToReturn = constructChatObject(updatedConversation, messagesForReturn);
    await updateCacheWithSharePath(id, chatToReturn);
    return chatToReturn;

  } else if (userTier === 'guest') {
    // Logic for guest users
    const { data: existingGuestConv, error: queryError } = await supabase
      .from('conversations')
      .select('*') // Select all needed fields
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (queryError) {
      console.error(`Error checking Supabase for existing guest chat ${id}:`, queryError);
      return null;
    }

    if (existingGuestConv) {
      // Guest chat already persisted (e.g., shared before), just update share_path & updated_at
      const { data: updatedConv, error: updateError } = await supabase
        .from('conversations')
        .update({
          share_path: sharePathValue,
          updated_at: new Date().toISOString()
        })
        .eq('id', id) // id is chat.id
        .eq('user_id', userId)
        .select()
        .single();

      if (updateError || !updatedConv) {
        console.error(`Supabase error updating share_path for already persisted guest chat ${id}:`, updateError);
        return null;
      }
      
      // Fetch messages for the return object and cache update
      const { data: dbMessages } = await supabase.from('messages').select('*').eq('conversation_id', id).order('created_at');
      let messages: ExtendedCoreMessage[] = [];
      if (dbMessages) {
        messages = dbMessages.map(msg => ({
            role: msg.role as CoreMessage['role'] | 'data',
            content: typeof msg.content === 'string' && (msg.content.startsWith('{') || msg.content.startsWith('[')) ? JSON.parse(msg.content) : msg.content
        }));
      }

      const chatToReturn = constructChatObject(updatedConv, messages);
      await updateCacheWithSharePath(id, chatToReturn);
      return chatToReturn;

    } else {
      // Guest chat NOT in Supabase. Fetch from Upstash, persist to Supabase, then share.
      const rawChatFromCache = await redis.hgetall<Record<string, any>>(`chat:${id}`);

      if (!rawChatFromCache || Object.keys(rawChatFromCache).length === 0 || rawChatFromCache.userId !== userId) {
        console.warn(`Guest chat ${id} not found in Upstash cache or userId mismatch for sharing.`);
        return null;
      }

      // Parse and reconstruct chat data from cache
      let cachedMessages: ExtendedCoreMessage[] = [];
      if (typeof rawChatFromCache.messages === 'string') {
        try {
          cachedMessages = JSON.parse(rawChatFromCache.messages);
        } catch (e) {
          console.error("Error parsing messages from guest cache for chat:", id, e);
          return null; // Cannot proceed without messages
        }
      } else if (Array.isArray(rawChatFromCache.messages)) {
        cachedMessages = rawChatFromCache.messages; // Assume it's already ExtendedCoreMessage[]
      }
      
      const chatFromCacheData: Chat = {
        id: rawChatFromCache.id as string,
        title: rawChatFromCache.title as string,
        createdAt: new Date(rawChatFromCache.createdAt as string | Date),
        userId: rawChatFromCache.userId as string,
        path: rawChatFromCache.path as string,
        messages: cachedMessages,
        sharePath: rawChatFromCache.sharePath as string | undefined
      };


      // 1. Persist conversation to Supabase
      const { data: newConversation, error: convInsertError } = await supabase
        .from('conversations')
        .insert({
          id: chatFromCacheData.id,
          user_id: userId,
          title: chatFromCacheData.title,
          path: chatFromCacheData.path,
          created_at: new Date(chatFromCacheData.createdAt).toISOString(),
          updated_at: new Date().toISOString(),
          share_path: sharePathValue // Set the share_path now
        })
        .select()
        .single();

      if (convInsertError || !newConversation) {
        console.error(`Supabase error inserting guest conversation ${chatFromCacheData.id}:`, convInsertError);
        return null;
      }

      // 2. Persist messages to Supabase
      if (chatFromCacheData.messages && chatFromCacheData.messages.length > 0) {
        const messagesToInsert = chatFromCacheData.messages.map(message => ({
          conversation_id: chatFromCacheData.id,
          user_id: userId,
          role: message.role,
          content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
          tokens: ('tokens' in message && typeof message.tokens === 'number') ? message.tokens : 0, // Defaulted tokens to 0
          created_at: new Date().toISOString() // Messages get current timestamp on first persistence
        }));

        const { error: msgInsertError } = await supabase
          .from('messages')
          .insert(messagesToInsert);

        if (msgInsertError) {
          console.error(`Supabase error inserting messages for guest chat ${chatFromCacheData.id}:`, msgInsertError);
          // Potentially rollback conversation insert or mark as incomplete
          return null;
        }
      }
      
      const chatToReturn = constructChatObject(newConversation, chatFromCacheData.messages);
      await updateCacheWithSharePath(id, chatToReturn); // Update cache with sharePath
      return chatToReturn;
    }
  }
  return null; // Should not be reached if all tiers are handled
}