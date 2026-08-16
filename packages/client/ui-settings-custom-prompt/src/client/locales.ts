/** `settings.custom-prompt` namespace dictionaries (the custom-prompt page copy). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'nav': '自定义提示词',
  'title': '自定义提示词',
  'description': '这段内容会作为系统提示词注入每一次对话，模型在开始回答前都会看到它。',
  'placeholder': '例如：请始终用中文回答，先给出结论再解释。',
  'hint': '保存后立即生效，从下一次对话开始使用。',
  'save': '保存',
  'clear': '清除',
  'unsaved': '有未保存的修改',
  'saving': '保存中…',
  'saveFailed': '保存失败，请重试',
  'readOnly': '当前连接为只读，无法保存设置',
} satisfies Record<string, string>

/** The settings.custom-prompt namespace key union. */
export type CustomPromptKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'nav': 'Custom prompt',
  'title': 'Custom prompt',
  'description': 'This text is injected into every conversation as part of the system prompt, before the model answers.',
  'placeholder': 'For example: always answer in Chinese, conclusion first.',
  'hint': 'Takes effect immediately, starting with the next conversation.',
  'save': 'Save',
  'clear': 'Clear',
  'unsaved': 'Unsaved changes',
  'saving': 'Saving…',
  'saveFailed': 'Save failed, please retry',
  'readOnly': 'This connection is read-only; settings cannot be saved',
} satisfies Record<CustomPromptKey, string>
