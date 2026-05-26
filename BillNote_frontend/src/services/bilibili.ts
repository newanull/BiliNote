import request from '@/utils/request'

export interface BilibiliUser {
  mid: number
  uname: string
  face: string
}

export interface FavFolder {
  id: number
  fid: number
  title: string
  media_count: number
  cover: string
  season_id?: number
  upper?: {
    mid?: number
    name?: string
    face?: string
  }
}

export interface FavVideo {
  id: number | string
  bvid: string
  title: string
  cover: string
  duration: number
  upper: { name?: string }
}

export interface FavVideoResult {
  info: Record<string, any>
  medias: FavVideo[]
  has_more: boolean
  pn: number
}

export type FolderType = 'created' | 'collected'

export const getFavoriteFolders = (
  type: FolderType = 'created',
): Promise<{
  user: BilibiliUser
  folders: FavFolder[]
}> => {
  return request.get('/bilibili/favorites/folders', { params: { type } })
}

export const getFavoriteVideos = (
  mediaId?: number,
  pn: number = 1,
  ps: number = 20,
  seasonId?: number,
): Promise<FavVideoResult> => {
  const params: Record<string, any> = { pn, ps }
  if (seasonId != null) params.season_id = seasonId
  else if (mediaId != null) params.media_id = mediaId
  return request.get('/bilibili/favorites/videos', { params })
}
