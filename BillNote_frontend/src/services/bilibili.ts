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

export const getFavoriteFolders = (): Promise<{
  user: BilibiliUser
  folders: FavFolder[]
}> => {
  return request.get('/bilibili/favorites/folders')
}

export const getFavoriteVideos = (
  mediaId: number,
  pn: number = 1,
  ps: number = 20,
): Promise<FavVideoResult> => {
  return request.get('/bilibili/favorites/videos', {
    params: { media_id: mediaId, pn, ps },
  })
}
