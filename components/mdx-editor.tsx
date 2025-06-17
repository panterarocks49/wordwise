"use client"

import { MDXEditor, headingsPlugin, listsPlugin, quotePlugin, markdownShortcutPlugin, linkPlugin, linkDialogPlugin, imagePlugin, codeBlockPlugin, codeMirrorPlugin, diffSourcePlugin, toolbarPlugin, UndoRedo, BoldItalicUnderlineToggles, ListsToggle, BlockTypeSelect, CreateLink, InsertImage, InsertCodeBlock } from '@mdxeditor/editor'
import { SpellCheckWrapper } from './spell-check-plugin'

interface MDXEditorProps {
  content: string
  onChange: (content: string) => void
}

export default function MDXEditorComponent({ content, onChange }: MDXEditorProps) {
  return (
    <SpellCheckWrapper content={content} onChange={onChange}>
      <MDXEditor
        markdown={content}
        onChange={onChange}
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