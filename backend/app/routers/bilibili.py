from fastapi import APIRouter, Query

from app.services.bilibili_api import BilibiliAPIClient
from app.utils.logger import get_logger
from app.utils.response import ResponseWrapper as R

logger = get_logger(__name__)
router = APIRouter()


def _safe_error(client: BilibiliAPIClient, fallback: str, code: int):
    return R.error(msg=client.last_error or fallback, code=code)


@router.get("/bilibili/favorites/folders")
def get_favorite_folders():
    """Get folders created by the configured Bilibili account."""
    client = BilibiliAPIClient()
    if not client.has_cookie():
        return R.error(
            msg="请先在设置中配置 Bilibili Cookie（需要 SESSDATA）",
            code=401,
        )

    user_info = client.get_user_info()
    if user_info is None:
        return _safe_error(client, "获取用户信息失败，请检查 Cookie 是否有效", 401)

    folders = client.get_created_folders(user_info.get("mid"))
    if folders is None:
        return _safe_error(client, "获取收藏夹列表失败，请检查 Cookie 是否有效", 502)

    return R.success(data={
        "user": user_info,
        "folders": folders,
    })


@router.get("/bilibili/favorites/videos")
def get_favorite_videos(
    media_id: int = Query(..., description="收藏夹 media_id"),
    pn: int = Query(1, ge=1),
    ps: int = Query(20, ge=1, le=20),
):
    """Get videos from one favorite folder, with pagination."""
    client = BilibiliAPIClient()
    if not client.has_cookie():
        return R.error(
            msg="请先在设置中配置 Bilibili Cookie（需要 SESSDATA）",
            code=401,
        )

    result = client.get_folder_videos(media_id, pn=pn, ps=ps)
    if result is None:
        return _safe_error(client, "获取收藏夹视频失败，请检查 media_id 是否正确", 502)

    return R.success(data=result)
