"""Shared run-folder contracts (양찬팀 x 세리팀). The models here are the source of truth;
`python contracts.py schemas` writes contracts/*.schema.json and `python contracts.py check <folder>`
validates the contract files that exist in a run folder."""
import json, sys
from pathlib import Path
from typing import Annotated, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, RootModel, ValidationError, model_validator

REPO = Path(__file__).resolve().parents[2]
SCHEMAS = REPO/'contracts'
Sha256 = Annotated[str, Field(pattern='^[a-f0-9]{64}$')]
Point = Annotated[list[int], Field(min_length=2, max_length=2)]


class Open(BaseModel):
    # Extra keys are kept so either team can add fields without breaking the other.
    model_config = ConfigDict(extra='allow')


class Color(BaseModel):
    gain: list[float] = Field(min_length=3, max_length=3)
    bias: list[float] = Field(min_length=3, max_length=3)


class Dsl(Open):
    """Visual DSL: what the request asks for, before any asset is chosen."""
    version: Literal['dsl-v1'] = 'dsl-v1'
    parser: str = Field(description='rules-v1 or llm:<model>')
    source_text: str = ''
    theme: str
    season: Optional[str] = None
    lighting: Optional[str] = None
    weather: Optional[str] = None
    mood: list[str] = []
    keywords: list[str] = []
    night: bool
    twinkle: bool = False
    decorations: list[str]
    color: Optional[Color] = None
    target_maps: list[str] = Field(min_length=1)
    warnings: list[str] = []


class Instance(BaseModel):
    """Top-left map pixel of one placement; w/h when the group spans several tiles."""
    x: int = Field(ge=0)
    y: int = Field(ge=0)
    w: Optional[int] = Field(default=None, gt=0)
    h: Optional[int] = Field(default=None, gt=0)


class Group(Open):
    group_id: str
    kind: str
    confidence: float = Field(ge=0, le=1)
    source: Literal['tsx', 'cc', 'tile'] = Field(description='tsx: TSX type names; cc: connected components + hash; tile: one unnamed tile, kind from its layer')
    layer: str
    tile_ids: list[int] = Field(default=[], description='tsx groups: local tile ids in the tileset')
    hash: Optional[Sha256] = Field(default=None, description='cc groups: SHA-256 of the RGBA crop')
    size: Optional[Point] = None
    instances: list[Instance] = Field(min_length=1)

    @model_validator(mode='after')
    def identity(self):
        if self.source in ('tsx', 'tile') and not self.tile_ids: raise ValueError(f'{self.source} group needs tile_ids')
        if self.source == 'cc' and not self.hash: raise ValueError('cc group needs hash')
        return self


class GroupManifest(Open):
    version: Literal['group-manifest-v1'] = 'group-manifest-v1'
    mapId: str
    tileset: str
    tile_size: list[int] = Field(min_length=2, max_length=2)
    groups: list[Group]


class Label(BaseModel):
    kind: str
    by: str = Field(description='tsx, human:<name> or model:<name>')
    at: str = Field(description='ISO 8601 time')
    confidence: Optional[float] = Field(default=None, ge=0, le=1)


class Labels(RootModel[dict[Sha256, Label]]):
    """Kind cache for cc groups, keyed by the crop hash."""
    model_config = ConfigDict(json_schema_extra={'additionalProperties': False})


class PlanRow(Open):
    asset: str = Field(description='group_id from group-manifest.json')
    kind: str
    action: Literal['decorate', 'recolor', 'add', 'cover', 'skip']
    prompt: str = ''
    decorations: list[str] = []
    instances: Optional[int | list[Instance]] = None
    candidates: int = Field(default=1, ge=1, le=8, description='best-of-N')
    seed: Optional[int] = Field(default=None, description='only a seed the backend really used')
    reason: str = ''


class Plan(RootModel[list[PlanRow]]):
    pass


class Validation(Open):
    source_hashes_unchanged: bool
    alpha_preserved: Optional[bool] = None
    all_variant_alpha_preserved: Optional[bool] = None
    tiles_covered: Optional[int] = None
    changed_pixels: Optional[int] = None
    out_of_bounds_pixels: Optional[int] = None


class Layers(BaseModel):
    decoration: str
    recolor: Optional[str] = None


class Manifest(Open):
    """Runtime selection file (crypt-manifest.json). `overlay` is the legacy single layer."""
    id: str = Field(pattern='^[a-f0-9]{32}$')
    mapId: str
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    night: float = Field(ge=0, le=1)
    bulbs: list[Point]
    source_hashes: dict[str, Sha256]
    overlay: Optional[str] = None
    layers: Optional[Layers] = None
    parent_run_id: Optional[str] = Field(default=None, pattern='^[a-f0-9]{32}$')

    model_config = ConfigDict(extra='allow', json_schema_extra={'anyOf': [{'required': ['overlay']}, {'required': ['layers']}]})

    @model_validator(mode='after')
    def has_layer(self):
        if not self.overlay and not self.layers: raise ValueError('manifest needs layers or legacy overlay')
        return self


CONTRACTS = {'dsl': Dsl, 'group-manifest': GroupManifest, 'labels': Labels, 'plan': Plan,
             'validation': Validation, 'manifest': Manifest}
FILES = {'dsl.json': 'dsl', 'group-manifest.json': 'group-manifest', 'labels.json': 'labels', 'plan.json': 'plan',
         'validation.json': 'validation', 'crypt-manifest.json': 'manifest', 'manifest.json': 'manifest'}


def schema(name):
    data = CONTRACTS[name].model_json_schema()
    return {'$schema': 'https://json-schema.org/draft/2020-12/schema', '$id': f'{name}.schema.json', **data}


def write_schemas(target=SCHEMAS):
    target.mkdir(exist_ok=True)
    for name in CONTRACTS:
        (target/f'{name}.schema.json').write_text(json.dumps(schema(name), ensure_ascii=False, indent=2)+'\n', encoding='utf8')


def check_folder(folder):
    """Validate every contract file present; returns {file: error or None}."""
    results = {}
    for filename, name in FILES.items():
        path = folder/filename
        # Town runs also write an older manifest.json (placements), which is not the runtime contract.
        if not path.is_file() or (filename == 'manifest.json' and 'mapId' not in path.read_text(encoding='utf8')):
            continue
        try:
            CONTRACTS[name].model_validate_json(path.read_text(encoding='utf8'))
            results[filename] = None
        except ValidationError as error:
            results[filename] = str(error)
    return results


if __name__ == '__main__':
    if sys.argv[1:2] == ['schemas']:
        write_schemas()
    elif sys.argv[1:2] == ['check'] and len(sys.argv) == 3:
        report = check_folder(Path(sys.argv[2]))
        for filename, error in report.items(): print(('OK   ' if error is None else 'FAIL ')+filename+('' if error is None else '\n'+error))
        sys.exit(1 if any(report.values()) or not report else 0)
    else:
        print('usage: python contracts.py schemas | check <run-folder>')
        sys.exit(2)
