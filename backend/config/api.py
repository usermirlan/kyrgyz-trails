from ninja import NinjaAPI

from accounts.api import router as auth_router
from trails.routers.community import router as community_router
from trails.routers.planner import router as planner_router
from trails.routers.trails import router as trails_router

api = NinjaAPI(title="Too Arna API", version="1.0.0")

api.add_router("/", trails_router)
api.add_router("/", community_router)
api.add_router("/", planner_router)
api.add_router("/auth", auth_router)
