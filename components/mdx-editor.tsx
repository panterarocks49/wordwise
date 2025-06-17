"use client"

import { MDXEditor, headingsPlugin, listsPlugin, quotePlugin, markdownShortcutPlugin, linkPlugin, linkDialogPlugin, imagePlugin, codeBlockPlugin, codeMirrorPlugin, diffSourcePlugin, toolbarPlugin, UndoRedo, BoldItalicUnderlineToggles, ListsToggle, BlockTypeSelect, CreateLink, InsertImage, InsertCodeBlock } from '@mdxeditor/editor'
import { SpellCheckWrapper } from './spell-check-plugin'
import { useEffect, useRef, useState } from 'react'
import { useDocumentStore } from '@/lib/stores/document-store'

interface MDXEditorProps {
  content: string
  onChange: (content: string) => void
}

export default function MDXEditorComponent({ content, onChange }: MDXEditorProps) {
  const editorRef = useRef<any>(null)
  const [lastExternalContent, setLastExternalContent] = useState(content)
  const isInternalChange = useRef(false)
  
  // Subscribe to store changes
  const { currentContent, contentChangeCount } = useDocumentStore()

  // Handle internal editor changes
  const handleChange = (newContent: string) => {
    isInternalChange.current = true
    setLastExternalContent(newContent)
    onChange(newContent)
  }

  // Force editor to update when content changes externally (from spell check)
  useEffect(() => {
    if (!isInternalChange.current && currentContent && currentContent !== lastExternalContent && editorRef.current) {
      console.log('External content change detected, updating editor')
      try {
        editorRef.current.setMarkdown(currentContent)
        setLastExternalContent(currentContent)
      } catch (error) {
        console.error('Error updating editor:', error)
      }
    }
    isInternalChange.current = false
  }, [currentContent, contentChangeCount, lastExternalContent])

  return (
    <SpellCheckWrapper content={content} onChange={onChange}>
      <MDXEditor
        ref={editorRef}
        markdown={content}
        onChange={handleChange}
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          markdownShortcutPlugin(),
          linkPlugin(),
          linkDialogPlugin(),
          imagePlugin(),
          codeBlockPlugin({
            defaultCodeBlockLanguage: 'javascript'
          }),
          codeMirrorPlugin({
            codeBlockLanguages: {
              js: 'javascript',
              javascript: 'javascript',
              jsx: 'javascript',
              ts: 'typescript',
              typescript: 'typescript',
              tsx: 'typescript',
              py: 'python',
              python: 'python',
              rust: 'rust',
              cpp: 'cpp',
              java: 'java',
              md: 'markdown',
              markdown: 'markdown',
              json: 'json',
              html: 'html',
              css: 'css',
              sql: 'sql',
              xml: 'xml',
              yaml: 'yaml',
            }
          }),
          diffSourcePlugin(),
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <UndoRedo />
                <BoldItalicUnderlineToggles />
                <ListsToggle />
                <BlockTypeSelect />
                <CreateLink />
                <InsertImage />
                <InsertCodeBlock />
              </>
            )
          })
        ]}
        contentEditableClassName="prose prose-lg max-w-none"
      />
    </SpellCheckWrapper>
  )
} 