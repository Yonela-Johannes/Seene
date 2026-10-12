import {expect,it} from 'vitest';
import {presentPreview,RESOURCES,SceneTransitionSchema,TRANSITION_PRESETS,SCENE_TRANSITION_DURATION,type TransitionPresetName} from '../../src/core';
it('shares canonical revision validation',()=>{
 expect(RESOURCES['present-preview']).toBe(presentPreview);
 const result=presentPreview({scene:{version:3,camera:{},focus:{},nodes:[{id:'host'}]}});
 expect(result.valid).toBe(true);
 if(result.valid)expect(result.definition.width).toBe(1400);
});
it.each([
 {scene:{nodes:[{id:'a'},{id:'a'}]}},
 {scene:{version:3,camera:{},focus:{distance:5},nodes:[]}},
 {scene:{version:3,camera:{},focus:{},nodes:[]},width:0},
 {scene:{version:3,camera:{},focus:{},nodes:[]},motion:{durationMs:100,tracks:[{target:{kind:'surface',id:'missing'},property:'x',keyframes:[{timeMs:0,value:20}]}]}},
])('rejects invalid source revision %j',input=>expect(presentPreview(input).valid).toBe(false));
it('parses scene transition with defaults',()=>{
 const parsed=SceneTransitionSchema.parse({});
 expect(parsed.type).toBe('crossfade');
 expect(parsed.durationMs).toBe(SCENE_TRANSITION_DURATION);
});
it('each transition preset has name, description, type and duration',()=>{
 for(const[name,preset]of Object.entries(TRANSITION_PRESETS)){
   expect(preset.name).toBeTruthy();
   expect(preset.description).toBeTruthy();
   expect(preset.durationMs).toBeGreaterThan(0);
 }
 expect(TRANSITION_PRESETS.crossfade.type).toBe('crossfade');
 expect(TRANSITION_PRESETS.camera.type).toBe('camera');
 expect(TRANSITION_PRESETS.focus.type).toBe('focus');
});
