"use client"

import React, { useEffect, useRef } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import { EditorView, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { TextSelection } from 'prosemirror-state'

// Language map for CodeMirror
const languageMap: { [key: string]: any } = {
  javascript: javascript(),
  js: javascript(),
  typescript: javascript(), // Use JS for TS since we don't have TS package
  ts: javascript(),
  python: python(),
  py: python(),
  html: html(),
  css: css(),
  json: json(),
  markdown: markdown(),
  md: markdown(),
}

interface CodeBlockComponentProps {
  node: {
    attrs: {
      language?: string
    }
    textContent: string
    nodeSize: number
  }
  updateAttributes: (attrs: any) => void
  getPos: () => number
  editor: any
}

export default function CodeBlockComponent({ 
  node, 
  updateAttributes, 
  getPos, 
  editor 
}: CodeBlockComponentProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const cmViewRef = useRef<EditorView | null>(null)
  const isUpdatingRef = useRef(false)

  const maybeEscape = (unit: string, dir: number) => {
    if (!cmViewRef.current) return false
    
    const { state } = cmViewRef.current
    const { selection } = state
    const { main } = selection
    
    if (!main.empty) return false
    
    if (unit === 'line') {
      const line = state.doc.lineAt(main.head)
      if (dir < 0 ? line.from > 0 : line.to < state.doc.length) {
        return false
      }
    } else {
      // char unit
      if (dir < 0 ? main.from > 0 : main.to < state.doc.length) {
        return false
      }
    }
    
    const pos = getPos()
    if (pos === undefined) return false
    
    const targetPos = pos + (dir < 0 ? 0 : node.nodeSize)
    const pmSelection = TextSelection.near(
      editor.state.doc.resolve(targetPos), 
      dir
    )
    
    const tr = editor.state.tr.setSelection(pmSelection).scrollIntoView()
    editor.view.dispatch(tr)
    editor.view.focus()
    
    return true
  }

  useEffect(() => {
    if (!editorRef.current) return

    const language = node.attrs.language || 'javascript'
    const languageExtension = languageMap[language] || javascript()

    const startState = EditorState.create({
      doc: node.textContent,
      extensions: [
        syntaxHighlighting(defaultHighlightStyle),
        languageExtension,
        oneDark,
        keymap.of([
          ...defaultKeymap,
          indentWithTab,
          {
            key: 'ArrowUp',
            run: () => maybeEscape('line', -1),
          },
          {
            key: 'ArrowLeft', 
            run: () => maybeEscape('char', -1),
          },
          {
            key: 'ArrowDown',
            run: () => maybeEscape('line', 1),
          },
          {
            key: 'ArrowRight',
            run: () => maybeEscape('char', 1),
          },
          {
            key: 'Ctrl-Enter',
            mac: 'Cmd-Enter',
            run: () => {
              if (editor.commands.exitCode()) {
                editor.view.focus()
                return true
              }
              return false
            },
          },
        ]),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged || isUpdatingRef.current) return
          
          const newText = update.state.doc.toString()
          const pos = getPos()
          
          if (pos !== undefined) {
            const { tr } = editor.state
            tr.replaceWith(
              pos + 1, 
              pos + node.nodeSize - 1, 
              newText ? editor.schema.text(newText) : []
            )
            editor.view.dispatch(tr)
          }
        }),
      ],
    })

    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    })

    cmViewRef.current = view

    // Focus handling
    const handleFocus = () => {
      view.focus()
    }

    editorRef.current.addEventListener('click', handleFocus)

    return () => {
      editorRef.current?.removeEventListener('click', handleFocus)
      view.destroy()
    }
  }, [node.attrs.language, maybeEscape, editor, getPos, node.nodeSize, node.textContent])

  // Update CodeMirror content when node content changes externally
  useEffect(() => {
    if (cmViewRef.current && !isUpdatingRef.current) {
      const currentText = cmViewRef.current.state.doc.toString()
      if (currentText !== node.textContent) {
        isUpdatingRef.current = true
        cmViewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentText.length,
            insert: node.textContent,
          },
        })
        isUpdatingRef.current = false
      }
    }
  }, [node.textContent])

  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    updateAttributes({ language: event.target.value })
  }

  return (
    <NodeViewWrapper className="code-block-wrapper">
      <div className="flex items-center justify-between p-2 bg-gray-800 text-white text-sm">
        <span>Code Block</span>
        <select
          value={node.attrs.language || 'javascript'}
          onChange={handleLanguageChange}
          className="bg-gray-700 text-white px-2 py-1 rounded text-xs"
        >
          <option value="javascript">JavaScript</option>
          <option value="typescript">TypeScript</option>
          <option value="python">Python</option>
          <option value="html">HTML</option>
          <option value="css">CSS</option>
          <option value="json">JSON</option>
          <option value="markdown">Markdown</option>
        </select>
      </div>
      <div 
        ref={editorRef} 
        className="code-mirror-editor"
        style={{ minHeight: '100px' }}
      />
    </NodeViewWrapper>
  )
} 