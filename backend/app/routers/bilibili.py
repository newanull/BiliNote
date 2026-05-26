from fastapi import APIRouter, Query

from app.services.bilibili_api import BilibiliAPIClient
from app.utils.logger import get_logger
from app.utils.response import ResponseWrapper as R

logger = get_logger(__name__)
router = APIRouter()


def _safe_error(client: BilibiliAPIClient, fallback: str, code: int):
    return R.error(msg=client.last_error or fallback, code=code)


@router.get("/bilibili/favorites/folders")
def get_favorite_folders(
    type: str = Query("created", description="created=我创建的, collected=我追的合集"),
):
    """Get folders of the configured Bilibili account (created or collected)."""
    client = BilibiliAPIClient()
    if not client.has_cookie():
        return R.error(
            msg="请先在设置中配置 Bilibili Cookie（需要 SESSDATA）",
            code=401,
        )

    user_info = client.get_user_info()
    if user_info is None:
        return _safe_error(client, "获取用户信息失败，请检查 Cookie 是否有效", 401)

    mid = user_info.get("mid")
    if type == "collected":
        folders = client.get_collected_folders(mid)
    else:
        folders = client.get_created_folders(mid)

    if folders is None:
        return _safe_error(client, "获取收藏夹列表失败，请检查 Cookie 是否有效", 502)

    return R.success(data={
        "user": user_info,
        "folders": folders,
    })


@router.get("/bilibili/favorites/videos")
def get_favorite_videos(
    media_id: int = Query(None, description="普通收藏夹 media_id"),
    season_id: int = Query(None, description="合集 season_id"),
    pn: int = Query(1, ge=1),
    ps: int = Query(20, ge=1, le=50),
):
    """Get videos from a favorite folder or season, with pagination."""
    client = BilibiliAPIClient()
    if not client.has_cookie():
        return R.error(
            msg="请先在设置中配置 Bilibili Cookie（需要 SESSDATA）",
            code=401,
        )

    if season_id is not None:
        result = client.get_season_videos(season_id, pn=pn, ps=ps)
    elif media_id is not None:
        result = client.get_folder_videos(media_id, pn=pn, ps=ps)
    else:
        return R.error(msg="请提供 media_id 或 season_id", code=400)

    if result is None:
        return _safe_error(client, "获取视频列表失败", 502)

    return R.success(data=result)
