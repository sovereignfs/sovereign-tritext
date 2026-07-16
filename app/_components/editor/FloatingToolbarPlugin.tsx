'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  INSERT_UNORDERED_LIST_COMMAND,
  $isListNode,
  REMOVE_LIST_COMMAND,
} from '@lexical/list';
import {
  $createQuoteNode,
  $isQuoteNode,
  $createHeadingNode,
  $isHeadingNode,
  type HeadingTagType,
} from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { mergeRegister } from '@lexical/utils';
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  type TextFormatType,
} from 'lexical';
import { $readFontSize } from './fontSize';
import { FontSizeControls } from './FontSizeControls';
import styles from './editor.module.css';

type BlockType = 'paragraph' | 'h1' | 'h2' | 'quote' | 'bullet';

interface ToolbarState {
  top: number;
  left: number;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  blockType: BlockType;
  fontSize: number;
}

function toolbarButtonClass(active: boolean): string {
  return [styles.toolbarButton, active && styles.toolbarButtonActive].filter(Boolean).join(' ');
}

/** Selection-triggered formatting toolbar: bold/italic/underline, block type, font size. */
export function FloatingToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const [state, setState] = useState<ToolbarState | null>(null);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || selection.isCollapsed()) {
      setState(null);
      return;
    }

    const rootElement = editor.getRootElement();
    const domSelection = window.getSelection();
    if (
      !rootElement ||
      !domSelection ||
      domSelection.rangeCount === 0 ||
      !rootElement.contains(domSelection.anchorNode)
    ) {
      setState(null);
      return;
    }

    const rect = domSelection.getRangeAt(0).getBoundingClientRect();
    const rootRect = rootElement.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setState(null);
      return;
    }

    const anchorNode = selection.anchor.getNode();
    const element =
      anchorNode.getKey() === 'root' ? anchorNode : anchorNode.getTopLevelElementOrThrow();
    let blockType: BlockType = 'paragraph';
    if ($isListNode(element)) blockType = 'bullet';
    else if ($isHeadingNode(element)) blockType = element.getTag() as 'h1' | 'h2';
    else if ($isQuoteNode(element)) blockType = 'quote';

    setState({
      top: rect.top - rootRect.top,
      left: rect.left - rootRect.left + rect.width / 2,
      isBold: selection.hasFormat('bold'),
      isItalic: selection.hasFormat('italic'),
      isUnderline: selection.hasFormat('underline'),
      blockType,
      fontSize: $readFontSize(),
    });
  }, [editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => updateToolbar());
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateToolbar();
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor, updateToolbar]);

  const format = (type: TextFormatType) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, type);
  };

  const toggleBlock = (type: BlockType, currentBlockType: BlockType) => {
    if (type === 'bullet') {
      editor.dispatchCommand(
        currentBlockType === 'bullet' ? REMOVE_LIST_COMMAND : INSERT_UNORDERED_LIST_COMMAND,
        undefined,
      );
      return;
    }
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      if (currentBlockType === type) {
        $setBlocksType(selection, () => $createParagraphNode());
        return;
      }
      if (type === 'quote') {
        $setBlocksType(selection, () => $createQuoteNode());
      } else if (type === 'h1' || type === 'h2') {
        $setBlocksType(selection, () => $createHeadingNode(type as HeadingTagType));
      }
    });
  };

  if (!state) return null;
  const { top, left, isBold, isItalic, isUnderline, blockType, fontSize } = state;

  return (
    <div
      className={styles.toolbar}
      style={{ top, left }}
      role="toolbar"
      aria-label="Text formatting"
    >
      <button
        type="button"
        className={toolbarButtonClass(isBold)}
        aria-label="Bold"
        aria-pressed={isBold}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => format('bold')}
      >
        B
      </button>
      <button
        type="button"
        className={toolbarButtonClass(isItalic)}
        aria-label="Italic"
        aria-pressed={isItalic}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => format('italic')}
      >
        I
      </button>
      <button
        type="button"
        className={toolbarButtonClass(isUnderline)}
        aria-label="Underline"
        aria-pressed={isUnderline}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => format('underline')}
      >
        U
      </button>
      <span className={styles.toolbarDivider} />
      <button
        type="button"
        className={toolbarButtonClass(blockType === 'h1')}
        aria-label="Heading 1"
        aria-pressed={blockType === 'h1'}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => toggleBlock('h1', blockType)}
      >
        H1
      </button>
      <button
        type="button"
        className={toolbarButtonClass(blockType === 'h2')}
        aria-label="Heading 2"
        aria-pressed={blockType === 'h2'}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => toggleBlock('h2', blockType)}
      >
        H2
      </button>
      <button
        type="button"
        className={toolbarButtonClass(blockType === 'quote')}
        aria-label="Quote"
        aria-pressed={blockType === 'quote'}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => toggleBlock('quote', blockType)}
      >
        &ldquo;
      </button>
      <button
        type="button"
        className={toolbarButtonClass(blockType === 'bullet')}
        aria-label="Bulleted list"
        aria-pressed={blockType === 'bullet'}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => toggleBlock('bullet', blockType)}
      >
        •
      </button>
      <span className={styles.toolbarDivider} />
      <FontSizeControls fontSize={fontSize} />
    </div>
  );
}
