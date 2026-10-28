import { createElement, Fragment, useMemo, type JSX, type ReactNode } from 'react'

const HTML_PATTERN =
  /<\/?(?:p|div|br|hr|ul|ol|li|h[1-6]|strong|b|em|i|code|pre|blockquote|a|del|s)\b[^>]*>/i

const SKIPPED_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'img'])

const HEADING_CLASS: Record<string, string> = {
  h1: 'mt-3 mb-1.5 text-[15px] font-semibold text-foreground first:mt-0',
  h2: 'mt-3 mb-1.5 text-sm font-semibold text-foreground first:mt-0',
  h3: 'mt-3 mb-1.5 text-[13px] font-semibold text-foreground first:mt-0',
  h4: 'mt-2.5 mb-1 text-[13px] font-semibold text-foreground first:mt-0',
  h5: 'mt-2 mb-1 text-xs font-semibold text-foreground first:mt-0',
  h6: 'mt-2 mb-1 text-xs font-semibold text-muted-foreground first:mt-0'
}

const PARAGRAPH_CLASS = 'mt-3 mb-1.5 font-medium text-foreground first:mt-0 last:mb-0'

const LIST_CLASS = 'mb-3 space-y-1 pl-4 last:mb-0'

const BLOCKQUOTE_CLASS = 'mb-2 border-l-2 border-border pl-2.5 italic last:mb-0'

const CODE_BLOCK_CLASS =
  'mb-2 overflow-x-auto rounded-md border border-border/60 bg-background/80 p-2 font-mono text-[11px] leading-relaxed last:mb-0'

const LINK_CLASS = 'text-primary underline underline-offset-2 hover:text-primary/80'

function safeHref(raw: string | null): string | undefined {
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined
  } catch {
    return undefined
  }
}

function renderNode(node: Node, key: string, parentTag: string): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue
  if (node.nodeType !== Node.ELEMENT_NODE) return null

  const element = node as Element
  const tag = element.tagName.toLowerCase()
  if (SKIPPED_TAGS.has(tag)) return null

  const children = Array.from(element.childNodes, (child, index) =>
    renderNode(child, `${key}-${index}`, tag)
  )

  switch (tag) {
    case 'p':
      return (
        <p key={key} className={PARAGRAPH_CLASS}>
          {children}
        </p>
      )
    case 'ul':
      return (
        <ul key={key} className={`list-disc ${LIST_CLASS}`}>
          {children}
        </ul>
      )
    case 'ol':
      return (
        <ol key={key} className={`list-decimal ${LIST_CLASS}`}>
          {children}
        </ol>
      )
    case 'li':
      return (
        <li key={key} className="leading-relaxed">
          {children}
        </li>
      )
    case 'strong':
    case 'b':
      return (
        <strong key={key} className="font-semibold text-foreground">
          {children}
        </strong>
      )
    case 'em':
    case 'i':
      return (
        <em key={key} className="italic">
          {children}
        </em>
      )
    case 'del':
    case 's':
      return (
        <del key={key} className="opacity-70">
          {children}
        </del>
      )
    case 'code':
      return parentTag === 'pre' ? (
        <code key={key}>{children}</code>
      ) : (
        <code
          key={key}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground"
        >
          {children}
        </code>
      )
    case 'pre':
      return (
        <pre key={key} className={CODE_BLOCK_CLASS}>
          {children}
        </pre>
      )
    case 'blockquote':
      return (
        <blockquote key={key} className={BLOCKQUOTE_CLASS}>
          {children}
        </blockquote>
      )
    case 'a': {
      const href = safeHref(element.getAttribute('href'))
      return href ? (
        <a key={key} href={href} target="_blank" rel="noreferrer noopener" className={LINK_CLASS}>
          {children}
        </a>
      ) : (
        <Fragment key={key}>{children}</Fragment>
      )
    }
    case 'br':
      return <br key={key} />
    case 'hr':
      return <hr key={key} className="my-3 border-border" />
    default: {
      const headingClass = HEADING_CLASS[tag]
      if (headingClass) {
        return createElement(tag, { key, className: headingClass }, children)
      }
      return <Fragment key={key}>{children}</Fragment>
    }
  }
}

interface ReleaseNotesProps {
  notes: string
}

export function ReleaseNotes({ notes }: ReleaseNotesProps): JSX.Element {
  const isHtml = HTML_PATTERN.test(notes)
  const nodes = useMemo(() => {
    if (!isHtml) return null
    const parsed = new DOMParser().parseFromString(notes, 'text/html')
    return Array.from(parsed.body.childNodes, (node, index) =>
      renderNode(node, `note-${index}`, '')
    )
  }, [isHtml, notes])

  if (!nodes) {
    return <div className="whitespace-pre-wrap">{notes}</div>
  }

  return <div>{nodes}</div>
}
