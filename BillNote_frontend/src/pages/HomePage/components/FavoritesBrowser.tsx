import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckSquare, FolderOpen, Loader2, Play, Square } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  type BilibiliUser,
  type FavFolder,
  type FavVideo,
  type FolderType,
  getFavoriteFolders,
  getFavoriteVideos,
} from '@/services/bilibili'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Props {
  selectedVideos: FavVideo[]
  onSelectedVideosChange: (videos: FavVideo[]) => void
  disabled?: boolean
}

type View = 'folders' | 'videos'

const PAGE_SIZE = 20
const PLACEHOLDER_IMAGE = '/placeholder.png'

const formatDuration = (seconds: number): string => {
  if (!seconds && seconds !== 0) return '--:--'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

const imageProxy = (url?: string) => {
  if (!url) return PLACEHOLDER_IMAGE
  if (url.startsWith('/')) return url
  return `/api/image_proxy?url=${encodeURIComponent(url)}`
}

export default function FavoritesBrowser({
  selectedVideos,
  onSelectedVideosChange,
  disabled = false,
}: Props) {
  const [view, setView] = useState<View>('folders')

  const [folderType, setFolderType] = useState<FolderType>('created')
  const [loadingFolders, setLoadingFolders] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<BilibiliUser | null>(null)
  const [folders, setFolders] = useState<FavFolder[]>([])

  const [selectedFolder, setSelectedFolder] = useState<FavFolder | null>(null)
  const [videos, setVideos] = useState<FavVideo[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [loadingVideos, setLoadingVideos] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const selectedBvids = useMemo(
    () => new Set(selectedVideos.map(video => video.bvid)),
    [selectedVideos],
  )
  const allLoadedSelected = videos.length > 0 && videos.every(video => selectedBvids.has(video.bvid))

  const loadFolders = useCallback(async () => {
    setLoadingFolders(true)
    setError(null)
    try {
      const data = await getFavoriteFolders(folderType)
      setUser(data.user)
      setFolders(data.folders || [])
    } catch (e: any) {
      setError(e?.msg || '加载收藏夹失败')
    } finally {
      setLoadingFolders(false)
    }
  }, [folderType])

  useEffect(() => {
    loadFolders()
  }, [loadFolders])

  const enterFolder = useCallback(
    async (folder: FavFolder) => {
      setSelectedFolder(folder)
      setView('videos')
      setPage(1)
      setVideos([])
      setLoadingVideos(true)
      setError(null)
      onSelectedVideosChange([])

      try {
        const data = await getFavoriteVideos(folder.id, 1, PAGE_SIZE, folder.season_id)
        setVideos(data.medias || [])
        setHasMore(data.has_more)
      } catch (e: any) {
        setError(e?.msg || '加载视频列表失败')
      } finally {
        setLoadingVideos(false)
      }
    },
    [onSelectedVideosChange],
  )

  const loadMore = useCallback(async () => {
    if (!selectedFolder || loadingMore) return
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const data = await getFavoriteVideos(selectedFolder.id, nextPage, PAGE_SIZE, selectedFolder.season_id)
      setVideos(prev => [...prev, ...(data.medias || [])])
      setHasMore(data.has_more)
      setPage(nextPage)
    } catch (e: any) {
      setError(e?.msg || '加载更多失败')
    } finally {
      setLoadingMore(false)
    }
  }, [selectedFolder, page, loadingMore])

  const backToFolders = () => {
    setView('folders')
    setSelectedFolder(null)
    setVideos([])
    setPage(1)
    setError(null)
    onSelectedVideosChange([])
  }

  const toggleVideo = (video: FavVideo) => {
    if (disabled) return
    if (selectedBvids.has(video.bvid)) {
      onSelectedVideosChange(selectedVideos.filter(item => item.bvid !== video.bvid))
      return
    }
    onSelectedVideosChange([...selectedVideos, video])
  }

  const selectLoadedVideos = () => {
    const merged = new Map(selectedVideos.map(video => [video.bvid, video]))
    videos.forEach(video => merged.set(video.bvid, video))
    onSelectedVideosChange(Array.from(merged.values()))
  }

  const clearSelection = () => {
    onSelectedVideosChange([])
  }

  const handleFolderTypeChange = (value: FolderType) => {
    setFolderType(value)
    setView('folders')
    setSelectedFolder(null)
    setVideos([])
    setFolders([])
    setPage(1)
    setError(null)
    onSelectedVideosChange([])
  }

  const renderFolderHeader = () => {
    if (!user) return null

    return (
      <div className="mb-2 flex items-center gap-2 text-xs text-neutral-500">
        {user.face && <img src={imageProxy(user.face)} alt="" className="h-5 w-5 rounded-full" />}
        <Select value={folderType} onValueChange={v => handleFolderTypeChange(v as FolderType)}>
          <SelectTrigger className="h-7 w-fit gap-1 border-0 px-1 text-xs shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created">我创建的收藏夹</SelectItem>
            <SelectItem value="collected">我追的合集/收藏夹</SelectItem>
          </SelectContent>
        </Select>
      </div>
    )
  }

  if (loadingFolders) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-neutral-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        加载收藏夹中...
      </div>
    )
  }

  if (error && view === 'folders') {
    return (
      <div className="w-full min-w-0 max-w-full space-y-2 overflow-hidden">
        {renderFolderHeader()}
        <div className="flex flex-col items-center gap-3 py-8 text-center">
        <FolderOpen className="h-8 w-8 text-neutral-300" />
        <p className="text-sm text-neutral-500">{error}</p>
        <Button variant="outline" size="sm" onClick={loadFolders}>
          重试
        </Button>
        </div>
      </div>
    )
  }

  if (view === 'folders') {
    if (folders.length === 0) {
      return (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <FolderOpen className="h-8 w-8 text-neutral-300" />
          <p className="text-sm text-neutral-500">暂无收藏夹</p>
        </div>
      )
    }

    return (
      <div className="w-full min-w-0 max-w-full space-y-2 overflow-hidden">
        {user && (
          <div className="mb-2 flex items-center gap-2 text-xs text-neutral-500">
            {user.face && (
              <img src={imageProxy(user.face)} alt="" className="h-5 w-5 rounded-full" />
            )}
            <Select
              value={folderType}
              onValueChange={v => setFolderType(v as FolderType)}
            >
              <SelectTrigger className="h-7 w-fit gap-1 border-0 px-1 text-xs shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created">{user.uname} 的收藏夹</SelectItem>
                <SelectItem value="collected">{user.uname} 追的合集</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <ScrollArea className="h-[260px] w-full max-w-full">
          <div className="w-full max-w-full space-y-1.5 pr-2">
            {folders.map(folder => (
              <Card
                key={folder.id}
                className="w-full min-w-0 max-w-full cursor-pointer overflow-hidden py-1 transition-colors hover:bg-accent"
                onClick={() => enterFolder(folder)}
              >
                <CardContent className="flex min-w-0 max-w-full items-center gap-2 px-2 py-1">
                  <img
                    src={imageProxy(folder.cover)}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded object-cover"
                  />
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="whitespace-normal break-words text-xs font-medium leading-tight [overflow-wrap:anywhere]">
                      {folder.title}
                    </p>
                    <p className="text-[11px] leading-tight text-neutral-400">{folder.media_count} 个视频</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-2 overflow-hidden">
      <div className="mb-2 flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={disabled}
          onClick={backToFolders}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{selectedFolder?.title}</span>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-neutral-500">
        <span>已选 {selectedVideos.length} 个视频</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-7 px-2 ${allLoadedSelected ? 'text-primary' : ''}`}
          disabled={disabled || videos.length === 0}
          onClick={allLoadedSelected ? clearSelection : selectLoadedVideos}
        >
          {allLoadedSelected ? (
            <CheckSquare className="mr-1 h-3.5 w-3.5" />
          ) : (
            <Square className="mr-1 h-3.5 w-3.5" />
          )}
          全选
        </Button>
      </div>

      {error && <p className="py-4 text-center text-sm text-neutral-500">{error}</p>}

      {loadingVideos && !error && (
        <div className="flex h-32 items-center justify-center text-sm text-neutral-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载视频中...
        </div>
      )}

      {!loadingVideos && !error && videos.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Play className="h-8 w-8 text-neutral-300" />
          <p className="text-sm text-neutral-500">该收藏夹暂无视频</p>
        </div>
      )}

      {!loadingVideos && videos.length > 0 && (
        <ScrollArea className="h-[240px] w-full max-w-full">
          <div className="w-full max-w-full space-y-1.5 pr-2">
            {videos.map(video => {
              const selected = selectedBvids.has(video.bvid)
              return (
                <Card
                  key={video.id}
                  className={`w-full min-w-0 max-w-full cursor-pointer overflow-hidden py-1 transition-colors hover:bg-accent ${
                    selected ? 'ring-primary ring-2' : ''
                  } ${disabled ? 'pointer-events-none opacity-70' : ''}`}
                  onClick={() => toggleVideo(video)}
                >
                  <CardContent className="flex min-w-0 max-w-full items-center gap-2 px-2 py-1">
                    <div
                      className="flex shrink-0"
                      onClick={event => {
                        event.stopPropagation()
                      }}
                    >
                      <Checkbox checked={selected} onCheckedChange={() => toggleVideo(video)} />
                    </div>
                    <div className="relative shrink-0">
                      <img src={imageProxy(video.cover)} alt="" className="h-8 w-8 rounded object-cover" />
                      <span className="absolute bottom-0 right-0 rounded bg-black/70 px-1 text-[10px] text-white">
                        {formatDuration(video.duration)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="whitespace-normal break-words text-xs leading-tight [overflow-wrap:anywhere]">
                        {video.title}
                      </p>
                      <p className="truncate text-[11px] leading-tight text-neutral-400">{video.upper?.name}</p>
                    </div>
                    {selected ? (
                      <CheckSquare className="text-primary h-4 w-4 shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 shrink-0 text-neutral-300" />
                    )}
                  </CardContent>
                </Card>
              )
            })}

            {hasMore && (
              <div className="flex justify-center py-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled || loadingMore}
                  onClick={event => {
                    event.stopPropagation()
                    loadMore()
                  }}
                >
                  {loadingMore && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                  加载更多
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
