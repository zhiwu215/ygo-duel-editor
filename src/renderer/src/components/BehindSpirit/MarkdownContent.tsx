import { memo, type JSX } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { usePacedText } from './usePacedText'

interface MarkdownContentProps {
  content: string
  className?: string
  isStreaming?: boolean
}

const components: Components = {
  h1({ children }) {
    return (
      <h1 className="text-sm font-bold mt-3 mb-2 first:mt-0 text-foreground leading-snug">
        {children}
      </h1>
    )
  },
  h2({ children }) {
    return (
      <h2 className="text-xs font-bold mt-2.5 mb-1.5 first:mt-0 text-foreground leading-snug">
        {children}
      </h2>
    )
  },
  h3({ children }) {
    return (
      <h3 className="text-xs font-bold mt-2 mb-1 first:mt-0 text-foreground leading-snug">
        {children}
      </h3>
    )
  },
  h4({ children }) {
    return (
      <h4 className="text-xs font-semibold mt-2 mb-1 first:mt-0 text-foreground leading-snug">
        {children}
      </h4>
    )
  },
  h5({ children }) {
    return (
      <h5 className="text-xs font-semibold mt-2 mb-1 first:mt-0 text-foreground leading-snug">
        {children}
      </h5>
    )
  },
  h6({ children }) {
    return (
      <h6 className="text-xs font-semibold mt-2 mb-1 first:mt-0 text-muted-foreground leading-snug">
        {children}
      </h6>
    )
  },
  p({ children }) {
    // break-words + break-all：AI 回包里常见无空格的长串（JSON 错误、URL、堆栈），
    // 仅 break-words 无法打断，会横向溢出气泡。
    return (
      <p className="mb-2 last:mb-0 leading-relaxed break-words [overflow-wrap:anywhere]">
        {children}
      </p>
    )
  },
  ul({ children }) {
    return <ul className="list-disc list-inside mb-2 last:mb-0 space-y-0.5">{children}</ul>
  },
  ol({ children }) {
    return <ol className="list-decimal list-inside mb-2 last:mb-0 space-y-0.5">{children}</ol>
  },
  li({ children }) {
    return <li className="leading-relaxed">{children}</li>
  },
  strong({ children }) {
    return <strong className="font-bold text-foreground">{children}</strong>
  },
  em({ children }) {
    return <em className="italic">{children}</em>
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-2 border-border pl-2.5 py-0.5 my-2 text-muted-foreground italic bg-muted/40 rounded-r">
        {children}
      </blockquote>
    )
  },
  hr() {
    return <hr className="my-2 border-border" />
  },
  a({ children, href }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300"
      >
        {children}
      </a>
    )
  },
  code({ className, children }) {
    const match = /language-(\w+)/.exec(className || '')
    const isBlock = className && match
    if (isBlock) {
      return (
        <code
          className={`${className} font-mono text-[10px] block break-words [overflow-wrap:anywhere]`}
        >
          {children}
        </code>
      )
    }
    return (
      <code className="font-mono text-[10px] px-1 py-0.5 rounded bg-muted text-foreground break-words [overflow-wrap:anywhere]">
        {children}
      </code>
    )
  },
  pre({ children }) {
    return (
      <pre className="rounded bg-muted p-2 my-2 overflow-x-auto border border-border/50">
        {children}
      </pre>
    )
  },
  table({ children }) {
    return (
      <table className="w-full text-[10px] border-collapse border border-border my-2">
        {children}
      </table>
    )
  },
  thead({ children }) {
    return <thead className="bg-muted">{children}</thead>
  },
  th({ children }) {
    return (
      <th className="border border-border px-2 py-1 text-left font-semibold text-foreground">
        {children}
      </th>
    )
  },
  td({ children }) {
    return <td className="border border-border px-2 py-1">{children}</td>
  },
  tr({ children }) {
    return <tr>{children}</tr>
  }
}

function MarkdownContentImpl({
  content,
  className,
  isStreaming = false
}: MarkdownContentProps): JSX.Element {
  const rendered = usePacedText(content, isStreaming)

  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
        {rendered}
      </ReactMarkdown>
    </div>
  )
}

export const MarkdownContent = memo(MarkdownContentImpl)
