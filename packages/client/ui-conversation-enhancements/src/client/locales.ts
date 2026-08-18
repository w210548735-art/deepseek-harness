/** `conversation.session-collaboration` namespace dictionaries. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'sessionDelegate.target': '协作目标会话',
  'sessionDelegate.prompt': '任务',
  'sessionDelegate.jump': '跳转到目标会话',
} satisfies Record<string, string>

/** The conversation.session-collaboration namespace key union. */
export type SessionCollaborationKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'sessionDelegate.target': 'Collaboration target session',
  'sessionDelegate.prompt': 'Task',
  'sessionDelegate.jump': 'Jump to target session',
} satisfies Record<SessionCollaborationKey, string>
