"""Static module registry - the submodule apps composed into this platform.

Reads `modules.yaml` at the GoalNexa repo root. Lives here (the parent
platform), not inside apps/platform-core - platform-core is a reusable
submodule and shouldn't hold the list of which modules a given platform
composes it with. See docs/architecture/microservices-design.md for the
planned dynamic version (`POST /internal/modules/register` at runtime);
this static file is today's stand-in.
"""

from __future__ import annotations

from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel

_MODULES_FILE = Path(__file__).resolve().parents[2] / "modules.yaml"


class ModuleConfig(BaseModel):
    name: str
    kind: Literal["kernel", "module"]
    path: str
    repo: str
    enabled: bool = True


def load_modules() -> list[ModuleConfig]:
    data = yaml.safe_load(_MODULES_FILE.read_text())
    return [ModuleConfig(**entry) for entry in data["modules"]]


def get_enabled_modules() -> list[ModuleConfig]:
    return [module for module in load_modules() if module.enabled]
