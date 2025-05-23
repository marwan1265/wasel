'use server'

import { createClient } from '@/lib/supabase/server'

export async function deleteUserAccount() {
  try {
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return { error: 'المستخدم غير مصرح له' }
    }

    // Delete user data from custom tables first
    // Delete conversations and messages
    const { data: conversations, error: fetchError } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', user.id)

    if (fetchError) {
      console.error('Error fetching user conversations:', fetchError)
    } else if (conversations && conversations.length > 0) {
      const conversationIds = conversations.map(conv => conv.id)
      
      // Delete messages
      const { error: msgError } = await supabase
        .from('messages')
        .delete()
        .in('conversation_id', conversationIds)

      if (msgError) {
        console.error('Error deleting user messages:', msgError)
      }

      // Delete conversations
      const { error: convError } = await supabase
        .from('conversations')
        .delete()
        .eq('user_id', user.id)

      if (convError) {
        console.error('Error deleting user conversations:', convError)
      }
    }

    // Delete user profile if it exists
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', user.id)

    if (profileError) {
      console.error('Error deleting user profile:', profileError)
    }

    // Note: We can't delete the auth user from the client side
    // This would need to be done through a database function or admin API
    // For now, we'll just delete the user data and sign them out
    
    return { success: true }
  } catch (error) {
    console.error('Error deleting user account:', error)
    return { error: 'حدث خطأ أثناء حذف الحساب' }
  }
} 