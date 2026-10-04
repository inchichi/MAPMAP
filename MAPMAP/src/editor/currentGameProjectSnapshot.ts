import type { GameStructureProfile } from './gameStructureProfile'

export const CURRENT_GAME_PROJECT_PROFILE: GameStructureProfile = {
  game_title: 'my-sample-rpg',
  engine: 'TypeScript + Vite + PixiJS-based 2D game',
  maps: [
    {
      id: 'town',
      name: 'Town',
      file: 'src/games/my-sample-rpg/assets/maps/town.tmx'
    },
    {
      id: 'hunting-ground',
      name: 'Hunting Ground',
      file: 'src/games/my-sample-rpg/assets/maps/hunting-ground.tmx'
    },
    {
      id: 'cave',
      name: 'Cave',
      file: 'src/games/my-sample-rpg/assets/maps/cave.tmx'
    },
    {
      id: 'crystal-mine',
      name: 'Crystal Mine',
      file: 'src/games/my-sample-rpg/assets/maps/crystal-mine.tmx'
    },
    {
      id: 'harvest-village',
      name: 'Harvest Village',
      file: 'src/games/my-sample-rpg/assets/maps/harvest-village.tmx'
    },
    {
      id: 'upstream-waterway',
      name: 'Upstream Waterway',
      file: 'src/games/my-sample-rpg/assets/maps/upstream-waterway.tmx'
    },
    {
      id: 'reed-village',
      name: 'Reed Village',
      file: 'src/games/my-sample-rpg/assets/maps/reed-village.tmx'
    },
    {
      id: 'sunken-forest',
      name: 'Sunken Forest',
      file: 'src/games/my-sample-rpg/assets/maps/sunken-forest.tmx'
    },
    {
      id: 'ruins-outskirts',
      name: 'Ruins Outskirts',
      file: 'src/games/my-sample-rpg/assets/maps/ruins-outskirts.tmx'
    },
    {
      id: 'sunken-temple-1f',
      name: 'Sunken Temple 1F',
      file: 'src/games/my-sample-rpg/assets/maps/sunken-temple-1f.tmx'
    },
    {
      id: 'sunken-temple-2f',
      name: 'Sunken Temple 2F',
      file: 'src/games/my-sample-rpg/assets/maps/sunken-temple-2f.tmx'
    }
  ],
  npcs: [
    {
      id: 'blacksmith',
      name: '대장장이',
      map: 'town',
      file: 'src/games/my-sample-rpg/assets/maps/town.tmx'
    },
    {
      id: 'potion_merchant',
      name: '물약상인',
      map: 'town',
      file: 'src/games/my-sample-rpg/assets/maps/town.tmx'
    },
    {
      id: 'wizard',
      name: '마법사',
      map: 'town',
      file: 'src/games/my-sample-rpg/assets/maps/town.tmx'
    },
    {
      id: 'santa',
      name: '산타',
      map: 'town',
      file: 'src/games/my-sample-rpg/assets/maps/town.tmx'
    },
    {
      id: 'villager_1',
      name: '마을 주민',
      map: 'town',
      file: 'src/games/my-sample-rpg/assets/maps/town.tmx'
    }
  ],
  items: [
    {
      id: 'health-potion',
      name: '체력 회복 포션',
      file: 'src/game/potionShop.ts'
    },
    {
      id: 'mana-potion',
      name: '마나 회복 포션',
      file: 'src/game/potionShop.ts'
    },
    {
      id: 'basic-sword',
      name: '기본 검',
      file: 'src/game/playerEquipment.ts'
    },
    {
      id: 'iron-sword',
      name: '철 검',
      file: 'src/game/playerEquipment.ts'
    }
  ],
  events: [
    {
      id: 'npc_dialogue_runtime',
      file: 'src/game/lua/createLuaCharacterControllerRuntime.ts'
    },
    {
      id: 'quest_progress',
      file: 'src/game/questLog.ts'
    },
    {
      id: 'scene_renderer_runtime',
      file: 'src/rendering/createPixiTiledMapView.ts'
    },
    {
      id: 'dynamic_event_registry',
      file: 'src/events/DynamicEventManager.ts'
    }
  ],
  dialogue_system: {
    file: 'src/games/my-sample-rpg/assets/lua/reply-with-message.lua',
    format: 'speaker, text, next'
  },
  event_system: {
    file: 'src/events/DynamicEventManager.ts',
    register_function: 'registerDynamicEventDefinition'
  },
  modifiable_files: [
    'src/games/my-sample-rpg/assets/maps/town.tmx',
    'src/games/my-sample-rpg/assets/lua/reply-with-message.lua',
    'src/game/questLog.ts',
    'src/game/lua/createLuaCharacterControllerRuntime.ts',
    'src/rendering/createPixiTiledMapView.ts',
    'src/main.ts',
    'src/events/DynamicEventManager.ts'
  ]
}
