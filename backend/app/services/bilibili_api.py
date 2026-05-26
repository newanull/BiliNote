"""
Bilibili user API client for favorites and account metadata.

The client reads the login cookie from CookieConfigManager and never exposes it
to callers.
"""

from typing import Optional

import requests

from app.services.cookie_manager import CookieConfigManager
from app.utils.logger import get_logger

logger = get_logger(__name__)

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


class BilibiliAPIClient:
    """Fetch Bilibili favorite folders and videos with the configured cookie."""

    def __init__(self):
        self._cookie = CookieConfigManager().get("bilibili") or ""
        self.last_error: Optional[str] = None

    def _headers(self) -> dict:
        headers = {
            "User-Agent": UA,
            "Referer": "https://www.bilibili.com",
        }
        if self._cookie:
            headers["Cookie"] = self._cookie
        return headers

    def _get(self, url: str, params: dict = None) -> Optional[dict]:
        self.last_error = None
        req = requests.PreparedRequest()
        req.prepare_url(url, params)
        logger.info("Bilibili API GET %s", req.url)

        try:
            resp = requests.get(url, params=params, headers=self._headers(), timeout=15)
            resp.raise_for_status()
            body = resp.json()
        except Exception as exc:
            self.last_error = "Bilibili API request failed"
            logger.warning("Bilibili API request failed: url=%s, error=%s", url, exc)
            return None

        if body.get("code") != 0:
            self.last_error = body.get("message") or body.get("msg") or "Bilibili API error"
            logger.warning(
                "Bilibili API returned error: url=%s, code=%s, msg=%s",
                req.url,
                body.get("code"),
                self.last_error,
            )
            return None

        logger.info("Bilibili API success: %s", req.url)
        return body.get("data")

    def has_cookie(self) -> bool:
        return bool(self._cookie)

    def get_user_info(self) -> Optional[dict]:
        """Return current logged-in user as {mid, uname, face}."""
        data = self._get("https://api.bilibili.com/x/space/myinfo")
        if data is None:
            data = self._get("https://api.bilibili.com/x/web-interface/nav")
        if data is None:
            return None

        mid = data.get("mid")
        if not mid:
            self.last_error = "Cookie is not logged in or has expired"
            return None

        return {
            "mid": mid,
            "uname": data.get("name") or data.get("uname") or "",
            "face": data.get("face") or "",
        }

    def get_created_folders(self, up_mid: int) -> Optional[list]:
        """Return folders created by the logged-in user."""
        if not up_mid:
            self.last_error = "Missing Bilibili user id"
            return None

        data = self._get(
            "https://api.bilibili.com/x/v3/fav/folder/created/list-all",
            params={"up_mid": up_mid},
        )
        if data is None:
            return None

        folders = []
        for item in data.get("list") or []:
            media_id = item.get("id")
            if media_id is None:
                continue
            folders.append(
                {
                    "id": media_id,
                    "fid": item.get("fid") or media_id,
                    "title": item.get("title") or "未命名收藏夹",
                    "media_count": item.get("media_count") or 0,
                    "cover": item.get("cover") or "",
                }
            )
        return folders

    def get_collected_folders(self, up_mid: int) -> Optional[list]:
        """Return folders the logged-in user follows / has collected."""
        if not up_mid:
            self.last_error = "Missing Bilibili user id"
            return None

        folders = []
        page = 1
        page_size = 20

        while True:
            data = self._get(
                "https://api.bilibili.com/x/v3/fav/folder/collected/list",
                params={"up_mid": up_mid, "pn": page, "ps": page_size, "platform": "web"},
            )
            if data is None:
                return None

            items = data.get("list") or []
            for item in items:
                fid = item.get("fid")
                item_id = item.get("id")
                # 有 fid → 普通收藏夹；无 fid → 合集，id 即为 season_id
                if fid:
                    media_id = fid
                    season_id = None
                elif item_id:
                    media_id = None
                    season_id = item_id
                else:
                    continue

                upper = item.get("upper") or {}
                folders.append(
                    {
                        "id": media_id or season_id,
                        "fid": fid,
                        "title": item.get("title") or "未命名收藏夹",
                        "media_count": item.get("media_count") or 0,
                        "cover": item.get("cover") or "",
                        "season_id": season_id,
                        "upper": {
                            "mid": upper.get("mid") or item.get("mid"),
                            "name": upper.get("name") or "",
                            "face": upper.get("face") or "",
                        },
                    }
                )

            total = data.get("count") or len(folders)
            if not items or len(folders) >= total:
                return folders
            page += 1

    def get_season_videos(self, season_id: int, pn: int = 1, ps: int = 20) -> Optional[dict]:
        """Return videos from a followed season/collection."""
        data = self._get(
            "https://api.bilibili.com/x/space/fav/season/list",
            params={"season_id": season_id, "pn": pn, "ps": ps},
        )
        if data is None:
            return None

        medias = self._normalize_videos(data.get("medias") or data.get("archives") or [])
        return {
            "info": data.get("info") or data.get("meta"),
            "medias": medias,
            "has_more": bool(data.get("has_more")),
            "pn": pn,
        }

    def _normalize_videos(self, items: list) -> list:
        medias = []
        for item in items:
            bvid = item.get("bvid") or item.get("bv_id")
            if not bvid:
                continue
            upper = item.get("upper") or {}
            owner = item.get("owner") or {}
            medias.append(
                {
                    "id": item.get("id") or item.get("aid") or bvid,
                    "bvid": bvid,
                    "title": item.get("title") or "未命名视频",
                    "cover": item.get("cover") or item.get("pic") or "",
                    "duration": item.get("duration") or 0,
                    "upper": {
                        "name": upper.get("name") or owner.get("name") or "",
                    },
                }
            )
        return medias

    def get_folder_videos(self, media_id: int, pn: int = 1, ps: int = 20) -> Optional[dict]:
        """Return favorite-folder videos normalized for the frontend."""
        data = self._get(
            "https://api.bilibili.com/x/v3/fav/resource/list",
            params={"media_id": media_id, "pn": pn, "ps": ps, "platform": "web"},
        )
        if data is None:
            return None

        return {
            "info": data.get("info"),
            "medias": self._normalize_videos(data.get("medias") or []),
            "has_more": bool(data.get("has_more")),
            "pn": pn,
        }
