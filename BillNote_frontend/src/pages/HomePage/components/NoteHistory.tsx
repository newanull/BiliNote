import { useTaskStore, type Task } from '@/store/taskStore'
import { cn } from '@/lib/utils.ts'
import { ChevronRight, Folder, Trash } from 'lucide-react'
import { Button } from '@/components/ui/button.tsx'
import Fuse from 'fuse.js'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip.tsx'
import LazyImage from "@/components/LazyImage.tsx";
import {FC, useState, useEffect, useMemo} from 'react'

interface NoteHistoryProps {
  onSelect: (taskId: string) => void
  selectedId: string | null
}

type HistoryItem =
  | { type: 'folder'; groupId: string; folderName: string; tasks: Task[] }
  | { type: 'task'; task: Task }

const NoteHistory: FC<NoteHistoryProps> = ({ onSelect, selectedId }) => {
  const tasks = useTaskStore(state => state.tasks)
  const removeTask = useTaskStore(state => state.removeTask)
  const baseURL = (String(import.meta.env.VITE_API_BASE_URL || 'api')).replace(/\/$/, '')
  const [rawSearch, setRawSearch] = useState('')
  const [search, setSearch] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const fuse = useMemo(() => new Fuse(tasks, {
    keys: ['audioMeta.title', 'folderName'],
    threshold: 0.4,
  }), [tasks])

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(rawSearch)
    }, 300)

    return () => clearTimeout(timer)
  }, [rawSearch])

  const filteredTasks = useMemo(() => {
    if (!search.trim()) return tasks

    const fuseResults = fuse.search(search)
    const matchedIds = new Set(fuseResults.map(r => r.item.id))

    // Also include all tasks from groups whose folderName matches the search
    const extraTasks: Task[] = []
    const searchLower = search.toLowerCase()
    const seenGroups = new Set<string>()
    for (const task of tasks) {
      if (
        task.groupId &&
        !seenGroups.has(task.groupId) &&
        task.folderName?.toLowerCase().includes(searchLower)
      ) {
        seenGroups.add(task.groupId)
        const groupTasks = tasks.filter(
          t => t.groupId === task.groupId && !matchedIds.has(t.id),
        )
        extraTasks.push(...groupTasks)
      }
    }

    return [...fuseResults.map(r => r.item), ...extraTasks]
  }, [tasks, search, fuse])

  const historyItems = useMemo<HistoryItem[]>(() => {
    const seenGroups = new Set<string>()
    const items: HistoryItem[] = []

    for (const task of filteredTasks) {
      if (task.groupId) {
        if (!seenGroups.has(task.groupId)) {
          seenGroups.add(task.groupId)
          const groupTasks = filteredTasks.filter(t => t.groupId === task.groupId)
          items.push({
            type: 'folder',
            groupId: task.groupId,
            folderName: task.folderName || '未命名收藏夹',
            tasks: groupTasks,
          })
        }
      } else {
        items.push({ type: 'task', task })
      }
    }

    return items
  }, [filteredTasks])

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  const renderTaskCard = (task: Task, indent: boolean = false) => (
    <div
      key={task.id}
      onClick={() => onSelect(task.id)}
      className={cn(
        'flex cursor-pointer flex-col rounded-md border border-neutral-200 p-3',
        indent && 'ml-3 border-l-2 border-l-neutral-300',
        selectedId === task.id && 'border-primary bg-primary-light',
      )}
    >
      <div className={cn('flex items-center gap-4')}>
        {task.platform === 'local' ? (
          <img
            src={
              task.audioMeta.cover_url ? `${task.audioMeta.cover_url}` : '/placeholder.png'
            }
            alt="封面"
            className="h-10 w-12 rounded-md object-cover"
          />
        ) : (
          <LazyImage
            src={
              task.audioMeta.cover_url
                ? `${baseURL}/image_proxy?url=${encodeURIComponent(task.audioMeta.cover_url)}`
                : '/placeholder.png'
            }
            alt="封面"
          />
        )}

        <div className="flex w-full items-center justify-between gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="line-clamp-2 max-w-[180px] flex-1 overflow-hidden text-sm text-ellipsis">
                  {task.audioMeta.title || '未命名笔记'}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{task.audioMeta.title || '未命名笔记'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <div className={'mt-2 flex items-center justify-between text-[10px]'}>
        <div className="shrink-0">
          {task.status === 'SUCCESS' && (
            <div className={'bg-primary w-10 rounded p-0.5 text-center text-white'}>
              已完成
            </div>
          )}
          {task.status !== 'SUCCESS' && task.status !== 'FAILED' ? (
            <div className={'w-10 rounded bg-green-500 p-0.5 text-center text-white'}>
              等待中
            </div>
          ) : (
            <></>
          )}
          {task.status === 'FAILED' && (
            <div className={'w-10 rounded bg-red-500 p-0.5 text-center text-white'}>失败</div>
          )}
        </div>

        <div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="small"
                  variant="ghost"
                  onClick={e => {
                    e.stopPropagation()
                    removeTask(task.id)
                  }}
                  className="shrink-0"
                >
                  <Trash className="text-muted-foreground h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>删除</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  )

  if (historyItems.length === 0) {
    return (
      <>
        <div className="mb-2">
          <input
            type="text"
            placeholder="搜索笔记标题..."
            className="w-full rounded border border-neutral-300 px-3 py-1 text-sm outline-none focus:border-primary"
            value={rawSearch}
            onChange={e => setRawSearch(e.target.value)}
          />
        </div>
        <div className="rounded-md border border-neutral-200 bg-neutral-50 py-6 text-center">
          <p className="text-sm text-neutral-500">暂无记录</p>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="mb-2">
        <input
          type="text"
          placeholder="搜索笔记标题或收藏夹名称..."
          className="w-full rounded border border-neutral-300 px-3 py-1 text-sm outline-none focus:border-primary"
          value={rawSearch}
          onChange={e => setRawSearch(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2 overflow-hidden">
        {historyItems.map(item => {
          if (item.type === 'folder') {
            const expanded = expandedGroups.has(item.groupId)
            return (
              <div key={item.groupId}>
                <div
                  onClick={() => toggleGroup(item.groupId)}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-neutral-200 p-3 transition-colors hover:bg-accent"
                >
                  <Folder className="h-4 w-4 shrink-0 text-neutral-400" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {item.folderName}
                  </span>
                  <span className="shrink-0 text-xs text-neutral-400">
                    {item.tasks.length} 个视频
                  </span>
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 shrink-0 text-neutral-400 transition-transform',
                      expanded && 'rotate-90',
                    )}
                  />
                </div>
                {expanded && (
                  <div className="mt-1.5 flex flex-col gap-1.5">
                    {item.tasks.map(task => renderTaskCard(task, true))}
                  </div>
                )}
              </div>
            )
          }
          return renderTaskCard(item.task)
        })}
      </div>
    </>
  )
}

export default NoteHistory
