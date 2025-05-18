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
      chats.map(async chatKey => {
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
  try {
    const supabase = await createSupabaseClient() // Instantiate Supabase client

    // 1. Fetch paginated conversation metadata from Supabase
    const { data: conversationsMeta, error: convListError } = await supabase
      .from('conversations')
      .select('id, title, created_at, user_id, path, share_path') // Select necessary fields
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (convListError) {
      console.error('Error fetching conversations from Supabase:', convListError)
      return { chats: [], nextOffset: null }
    }

    if (!conversationsMeta || conversationsMeta.length === 0) {
      return { chats: [], nextOffset: null }
    }

    // 2. Fetch full chat details for each conversation ID
    // This will utilize the getChat function which has cache-aside logic
    const chatPromises = conversationsMeta.map(conv => getChat(conv.id, userId))
    const resolvedChats = (await Promise.all(chatPromises)).filter(
      (chat): chat is Chat => chat !== null
    )

    // 3. Determine nextOffset
    const nextOffset = conversationsMeta.length === limit ? offset + limit : null

    return { chats: resolvedChats, nextOffset }
  } catch (error) {
    console.error('Error fetching chat page:', error)
    return { chats: [], nextOffset: null }
  }
}

export async function getChat(id: string, userId: string) {
  const redis = await getRedis() // Keep Redis for cache access
  let chatFromCache = await redis.hgetall<Chat>(`chat:${id}`)

  if (chatFromCache && Object.keys(chatFromCache).length > 0) {
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

  // Cache miss, fetch from Supabase
  const supabase = await createSupabaseClient()

  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    // .eq('user_id', userId) // Apply RLS in Supabase, or uncomment if specific user check needed here
    .single()

  if (convError) {
    console.error(`Error fetching conversation ${id} from Supabase:`, convError)
    return null
  }
  if (!conversation) {
    return null // Not found in Supabase
  }

  const { data: messagesData, error: msgError } = await supabase
    .from('messages')
    .select('*') // Select all fields to reconstruct ExtendedCoreMessage
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  if (msgError) {
    console.error(`Error fetching messages for chat ${id} from Supabase:`, msgError)
    // Decide if partial chat (conversation only) should be returned or null
    return null
  }

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
    sharePath: conversation.share_path || undefined
  }

  // Populate Upstash cache
  const chatToCache = {
    ...chatFromDb,
    messages: JSON.stringify(chatFromDb.messages) // Stringify messages for Redis
  }
  await redis.hmset(`chat:${chatFromDb.id}`, chatToCache)
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
    pipeline.del(chat)
    pipeline.zrem(userChatKey, chat)
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

    const chatDetails = await redis.hgetall<Chat>(chatKey)
    if (!chatDetails || Object.keys(chatDetails).length === 0) {
      console.warn(`Attempted to delete non-existent chat: ${chatId}`)
      return { error: 'Chat not found' }
    }

    // Optional: Check if the chat actually belongs to the user if userId is provided and matters
    // if (chatDetails.userId !== userId) {
    //  console.warn(`Unauthorized attempt to delete chat ${chatId} by user ${userId}`)
    //  return { error: 'Unauthorized' }
    // }

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
          
          let tokens = null;
          if ('tokens' in message && typeof message.tokens === 'number') {
              tokens = message.tokens;
          } else if (typeof message.content === 'string') {
              // Fallback for tokens (currently placeholder)
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
      
      const chatFromCache: Chat = {
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
          id: chatFromCache.id,
          user_id: userId,
          title: chatFromCache.title,
          path: chatFromCache.path,
          created_at: new Date(chatFromCache.createdAt).toISOString(),
          updated_at: new Date().toISOString(),
          share_path: sharePathValue // Set the share_path now
        })
        .select()
        .single();

      if (convInsertError || !newConversation) {
        console.error(`Supabase error inserting guest conversation ${chatFromCache.id}:`, convInsertError);
        return null;
      }

      // 2. Persist messages to Supabase
      if (chatFromCache.messages && chatFromCache.messages.length > 0) {
        const messagesToInsert = chatFromCache.messages.map(message => ({
          conversation_id: chatFromCache.id,
          user_id: userId,
          role: message.role,
          content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
          tokens: ('tokens' in message && typeof message.tokens === 'number') ? message.tokens : null,
          created_at: new Date().toISOString() // Messages get current timestamp on first persistence
        }));

        const { error: msgInsertError } = await supabase
          .from('messages')
          .insert(messagesToInsert);

        if (msgInsertError) {
          console.error(`Supabase error inserting messages for guest chat ${chatFromCache.id}:`, msgInsertError);
          // Potentially rollback conversation insert or mark as incomplete
          return null;
        }
      }
      
      const chatToReturn = constructChatObject(newConversation, chatFromCache.messages);
      await updateCacheWithSharePath(id, chatToReturn); // Update cache with sharePath
      return chatToReturn;
    }
  }
  return null; // Should not be reached if all tiers are handled
}
