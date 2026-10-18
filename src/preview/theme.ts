import {studioTheme} from './studio-theme';

export const previewTheme = `
${studioTheme}
[data-seene-preview]{position:fixed;inset:0;height:100dvh;overflow:hidden;background:transparent;color:#fff;min-height:0;width:100%;box-sizing:border-box;isolation:isolate}
.seene-chrome{font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-sizing:border-box;color:#fff}
.seene-viewport{position:absolute;inset:0;background:var(--seene-scene-backdrop, #000);overflow:hidden;display:flex;align-items:center;justify-content:center}
.seene-canvas{flex:none;position:relative;overflow:hidden;background:var(--seene-scene-backdrop, #000)}
.seene-canvas .website-walkthrough-timeline-controls{display:none!important}
.seene-bottom-blur{position:absolute;inset:auto 0 0;height:min(320px,50%);pointer-events:none;z-index:1}
.seene-bottom-blur i{position:absolute;inset:0;pointer-events:none;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);mask-image:linear-gradient(transparent,#000 55%);-webkit-mask-image:linear-gradient(transparent,#000 55%)}
.seene-bottom-blur i:first-child{background:rgb(0 0 0 / .28)}
.seene-bottom-blur i:nth-child(2){top:25%;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);mask-image:linear-gradient(transparent,#000 65%);-webkit-mask-image:linear-gradient(transparent,#000 65%)}
.seene-bottom-blur i:nth-child(3){top:50%;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);mask-image:linear-gradient(transparent,#000 80%);-webkit-mask-image:linear-gradient(transparent,#000 80%)}
.seene-footer{position:absolute;inset:auto 0 0;z-index:2;pointer-events:none;padding:24px max(24px,env(safe-area-inset-right)) max(20px,env(safe-area-inset-bottom)) max(24px,env(safe-area-inset-left));box-sizing:border-box;background:transparent}
.seene-controls{max-width:760px;max-height:calc(100dvh - 48px - env(safe-area-inset-bottom));overflow:auto;overscroll-behavior:contain;margin:0 auto;display:flex;flex-direction:column;gap:12px;pointer-events:auto;padding:6px;scrollbar-width:thin;scrollbar-color:#666 transparent}
.seene-header{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-shrink:0}
.seene-heading{display:flex;align-items:center;gap:16px;min-width:0}
.seene-title{font-size:15px;font-weight:600;letter-spacing:-.2px;color:#fff;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.seene-control{appearance:none;box-sizing:border-box;border:1px solid #ffffff30;border-radius:999px;padding:11px 18px;background:#242424;color:#fff;font:500 13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-decoration:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:9px;white-space:nowrap;min-height:44px;flex-shrink:0;transition:background .15s;box-shadow:none}
.seene-control:hover{background:#3a3a3a}.seene-control:disabled{opacity:.45;cursor:default}
.seene-control:focus-visible,.seene-timeline:focus-visible,.seene-export-panel select:focus-visible,[data-seene-error] button:focus-visible{outline:2px solid #fff;outline-offset:3px}
.seene-presentations{display:flex;flex-direction:column;align-items:center;gap:7px;width:100%;min-width:0;flex-shrink:0}
.seene-transitions{display:flex;flex-direction:column;align-items:center;gap:7px;width:100%;min-width:0;flex-shrink:0}
.seene-presentation-rail{display:flex;gap:6px;max-width:100%;overflow-x:auto;overscroll-behavior-x:contain;padding:2px;scrollbar-width:none}
.seene-presentation-rail::-webkit-scrollbar{display:none}
.seene-presentation-rail .seene-control{min-height:36px;padding:8px 14px;font-size:12px}
.seene-presentation-note{margin:0;max-width:520px;text-align:center;font-size:11px;line-height:1.4;color:#b9b9c2;text-wrap:balance}
.seene-primary{background:#fff;color:#111;border-color:transparent}.seene-primary:hover{background:#e5e5e5}
.seene-icon{width:44px;padding:12px}.seene-control svg{width:17px;height:17px;flex:none}
.seene-dock{display:flex;align-items:center;gap:12px;width:100%;flex-shrink:0}
.seene-timeline{appearance:none;min-width:30px;flex:1;height:44px;margin:0;border-radius:999px;accent-color:#fff;cursor:pointer;background:transparent}
.seene-timeline::-webkit-slider-runnable-track{height:4px;background:#858585;border-radius:999px}
.seene-timeline::-webkit-slider-thumb{appearance:none;width:14px;height:14px;margin-top:-5px;border-radius:100%;background:#fff}
.seene-timeline::-moz-range-track{height:4px;background:#858585;border-radius:999px}
.seene-timeline::-moz-range-thumb{width:14px;height:14px;border:0;border-radius:100%;background:#fff}
.seene-timeline:disabled{opacity:.45;cursor:default}
.seene-time{font-size:12px;font-variant-numeric:tabular-nums;color:#fff;white-space:nowrap;min-width:88px}
.seene-preview-meta{display:flex;align-items:center;justify-content:center;gap:6px 18px;flex-wrap:wrap;flex-shrink:0}
.seene-status{font-size:12px;color:#e5e5e5;display:flex;gap:7px;align-items:center;justify-content:center;min-height:20px;flex-shrink:0}
.seene-status-dot{width:5px;height:5px;background:currentColor;border-radius:50%}
.seene-message,[data-seene-preview] [data-seene-error]{background:#202020;border:1px solid #ffffff30;border-radius:20px;padding:16px 20px;font:13px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#fff;margin:0;max-height:25dvh;overflow:auto;overflow-wrap:anywhere;flex-shrink:0}
.seene-message p,[data-seene-error] p{margin:6px 0}.seene-message ul{padding-left:20px;margin:8px 0}
[data-seene-preview] [data-seene-error] button{border:0;border-radius:999px;padding:12px 20px;min-height:44px;background:#fff;color:#111;font:inherit;cursor:pointer}
.seene-empty{max-width:410px;text-align:center;padding:24px;margin:auto;align-self:center}
.seene-empty h1{font-size:38px;line-height:1.15;font-weight:500;letter-spacing:-1.8px;margin:24px 0 16px}
.seene-empty p{color:#aaa;line-height:1.8;margin:0;font-size:14px}
.seene-empty-symbol{display:inline-flex;align-items:center;justify-content:center;width:72px;height:72px;border-radius:26px;background:#202020;color:#fff;font-size:30px}
.seene-onboarding{flex-shrink:0}.seene-onboarding summary,.seene-export summary{list-style:none}.seene-onboarding summary::-webkit-details-marker,.seene-export summary::-webkit-details-marker{display:none}
.seene-export-slot:empty{display:none}
.seene-export-panel{margin-left:auto;width:min(350px,100%);box-sizing:border-box;padding:22px;background:#202020;border:1px solid #ffffff30;border-radius:24px;white-space:normal;overflow-wrap:anywhere}
.seene-export-panel p{color:#d4d4d4;line-height:1.6;margin:8px 0 16px}.seene-export-panel select{border:1px solid #ffffff40;background:#333;color:#fff;padding:9px 14px;border-radius:999px;font:inherit;margin-left:12px;min-height:44px;max-width:100%}
.seene-export-panel code{display:block;background:#111;color:#eee;font-size:11px;padding:14px;border-radius:14px;overflow-wrap:anywhere;white-space:pre-wrap;margin:16px 0}
.seene-inspector-panel{position:fixed;top:0;right:0;bottom:0;width:380px;max-width:100%;background:#121215;border-left:1px solid #27272a;box-shadow:-8px 0 24px rgba(0,0,0,0.6);z-index:9999;overflow-y:auto;color:#e4e4e7;padding:20px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-sizing:border-box}
.seene-inspector-header{display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:1px solid #27272a;margin-bottom:16px}
.seene-inspector-section{background:#18181b;border:1px solid #27272a;border-radius:12px;padding:12px;margin-bottom:12px;box-sizing:border-box}
.seene-inspector-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px}
.seene-inspector-grid-2{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:8px}
.seene-inspector-input{width:100%;background:#09090b;border:1px solid #27272a;border-radius:6px;padding:6px 10px;color:#fff;font-size:12px;box-sizing:border-box}
.seene-inspector-slider{width:100%;height:4px;accent-color:#6366f1;cursor:pointer}
[data-seene-preview] [data-seene-diagnostics]{display:none}
@media(max-width:700px){.seene-footer{padding:12px max(10px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left))}.seene-controls{gap:10px;max-height:calc(100dvh - 24px - env(safe-area-inset-bottom))}.seene-header{gap:8px}.seene-heading{flex-wrap:wrap;gap:8px}.seene-title{flex-basis:100%;font-size:13px}.seene-presentation-rail{justify-content:flex-start}.seene-presentation-note{display:none}.seene-control{padding:10px 14px}.seene-icon{padding:12px}.seene-dock{gap:8px}.seene-time{min-width:76px;font-size:11px}.seene-empty h1{font-size:30px}}
@media(max-height:500px){.seene-footer{padding-top:8px;padding-bottom:max(8px,env(safe-area-inset-bottom))}.seene-controls{gap:8px;max-height:calc(100dvh - 16px - env(safe-area-inset-bottom))}.seene-empty-symbol{display:none}.seene-empty h1{font-size:24px;margin:0 0 8px}}
@media(prefers-reduced-motion:reduce){.seene-control{transition:none}}
/* Walkthrough studio: sequence canvas, continuous timeline and settings inspector. */
.seene-walkthrough-studio{position:fixed;inset:0;height:100dvh;display:flex;flex-direction:column;background:var(--seene-bg,#0c0c0f);color:var(--seene-text,#e4e4e7);font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;isolation:isolate;overflow:hidden}
.seene-studio-topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 16px;border-bottom:1px solid var(--seene-border-text,#27272a);background:var(--seene-surface-2,#141417);flex-wrap:wrap;flex-shrink:0}
.seene-studio-topbar-group{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap}
.seene-studio-title{background:#09090b;border:1px solid #27272a;border-radius:8px;padding:7px 12px;color:#fff;font:600 13px/1.4 inherit;min-width:200px}
.seene-studio-badge{border-radius:999px;padding:3px 10px;font-size:11px;font-weight:600;background:#1f2937;color:#c7d2fe}
.seene-studio-badge[data-state="invalid"]{background:#3f1d1d;color:#fca5a5}
.seene-studio-notice{margin:0;padding:10px 16px;border-bottom:1px solid #3f1d1d;background:#241417;color:#fca5a5;flex-shrink:0}
.seene-studio-notice ul{margin:6px 0 0;padding-left:18px}
.seene-studio-body{display:flex;flex:1;min-height:0}
.seene-studio-sequence{width:280px;flex-shrink:0;border-right:1px solid #27272a;background:#111114;overflow-y:auto;display:flex;flex-direction:column}
.seene-studio-panel-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px;border-bottom:1px solid #27272a}
.seene-studio-panel-head h2{margin:0;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#a1a1aa}
.seene-studio-nodes{list-style:none;margin:0;padding:8px 8px 0;display:flex;flex-direction:column;gap:2px}
.seene-studio-nodes li{position:relative;display:flex;align-items:center;gap:4px}
.seene-studio-node-connector{width:2px;align-self:stretch;margin-left:12px;background:#27272a}
.seene-studio-node{flex:1;display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;text-align:left;background:#18181b;border:1px solid #27272a;border-radius:10px;padding:8px 10px;color:#e4e4e7;cursor:pointer;min-width:0}
.seene-studio-node[data-selected="true"]{border-color:#6366f1;box-shadow:0 0 0 1px #6366f1}
.seene-studio-node[data-active="true"]{background:#1e1b4b}
.seene-studio-node[data-disconnected="true"]{border-color:#7f1d1d}
.seene-studio-node-type{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#a1a1aa;background:#0b0b0d;border-radius:6px;padding:2px 6px}
.seene-studio-node-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
.seene-studio-node-time{font-size:11px;font-variant-numeric:tabular-nums;color:#71717a}
.seene-studio-node-actions{display:flex;flex-direction:column;gap:2px}
.seene-studio-add-row{display:flex;flex-wrap:wrap;gap:6px;padding:12px;border-top:1px solid #27272a;margin-top:auto}
.seene-control.seene-small{min-height:30px;padding:5px 10px;font-size:11px}
.seene-control.seene-tiny{min-height:20px;padding:0;width:22px;font-size:11px;line-height:1}
.seene-control.seene-danger{border-color:#7f1d1d;color:#fca5a5}
.seene-studio-main{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0}
.seene-studio-viewport{position:relative;flex:1;min-height:0;overflow:hidden;background:var(--seene-scene-backdrop,#000)}
.seene-studio-viewport .seene-canvas{position:absolute;inset:0;width:100%;height:100%;background:var(--seene-scene-backdrop,#000)}
.seene-walkthrough-stage{position:relative;width:100%;height:100%}
.seene-walkthrough-scroll{position:relative;width:100%;height:100%;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scroll-behavior:auto}
.seene-walkthrough-caption{position:absolute;left:50%;transform:translateX(-50%);max-width:min(560px,80%);background:#0b0b0dcc;border:1px solid #ffffff26;border-radius:14px;padding:10px 16px;color:#fff;text-align:center;pointer-events:none;z-index:5}
.seene-walkthrough-caption[data-position="bottom"]{bottom:24px}
.seene-walkthrough-caption[data-position="top"]{top:24px}
.seene-walkthrough-caption[data-position="center"]{top:50%;transform:translate(-50%,-50%)}
[data-seene-walkthrough-active]{position:relative;outline:2px solid var(--seene-walkthrough-color,#7c9cff);outline-offset:var(--seene-walkthrough-padding,8px);border-radius:6px;opacity:calc(1 - var(--seene-walkthrough-opacity,1) * .3);transition:outline-color .2s}
.seene-studio-timeline{flex-shrink:0;border-top:1px solid #27272a;background:#111114;padding:10px 16px 14px;display:flex;flex-direction:column;gap:8px}
.seene-studio-transport{display:flex;align-items:center;gap:8px}
.seene-studio-time{font-size:12px;font-variant-numeric:tabular-nums;color:#a1a1aa;margin-left:auto}
.seene-studio-track{position:relative;height:34px;background:#0b0b0d;border:1px solid #27272a;border-radius:8px;overflow:hidden}
.seene-studio-segment{position:absolute;top:0;bottom:0;border:0;border-left:1px solid #00000066;background:#1e293b;color:#cbd5e1;font-size:11px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;padding:0 6px;cursor:pointer;text-align:left}
.seene-studio-segment[data-active="true"]{background:#4338ca}
.seene-studio-segment[data-selected="true"]{outline:1px solid #fff;outline-offset:-2px;z-index:2}
.seene-studio-playhead{position:absolute;top:0;bottom:0;width:2px;background:#fff;pointer-events:none;z-index:3}
.seene-studio-scrub{width:100%;accent-color:#6366f1;margin:0}
.seene-studio-inspector{width:340px;flex-shrink:0;border-left:1px solid #27272a;background:#111114;overflow-y:auto;padding:12px;box-sizing:border-box;display:flex;flex-direction:column;gap:10px}
.seene-studio-tabs{display:flex;gap:6px}
.seene-studio-tabs button{flex:1;background:#18181b;border:1px solid #27272a;border-radius:8px;padding:7px;color:#a1a1aa;cursor:pointer;font:600 12px/1.4 inherit}
.seene-studio-tabs button[aria-pressed="true"]{background:#6366f1;border-color:#6366f1;color:#fff}
.seene-inspector-status{margin:0;font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:.06em}
.seene-inspector-section h3{margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#a1a1aa}
.seene-inspector-hint{margin:0 0 8px;font-size:11px;color:#71717a}
.seene-inspector-fields{display:flex;flex-direction:column;gap:6px}
.seene-inspector-row{display:flex;align-items:center;gap:8px;font-size:12px}
.seene-inspector-row>span{flex:0 0 44%;color:#a1a1aa}
.seene-inspector-row input,.seene-inspector-row select,.seene-inspector-row textarea{flex:1;min-width:0;background:#09090b;border:1px solid #27272a;border-radius:6px;padding:5px 8px;color:#fff;font:12px inherit;box-sizing:border-box}
.seene-inspector-toggle{display:flex;align-items:center;gap:8px;font-size:12px;color:#a1a1aa;cursor:pointer}
.seene-inspector-actions{margin-top:4px}
.seene-studio-modal{position:absolute;inset:0;z-index:20;background:#000000aa;display:flex;align-items:center;justify-content:center;padding:24px}
.seene-studio-modal-panel{width:min(520px,100%);max-height:80%;overflow:auto;background:#141417;border:1px solid #27272a;border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:10px;box-sizing:border-box}
.seene-studio-search{background:#09090b;border:1px solid #27272a;border-radius:8px;padding:8px 12px;color:#fff}
.seene-studio-browser{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
.seene-studio-browser button{display:flex;flex-direction:column;gap:2px;width:100%;text-align:left;background:#18181b;border:1px solid #27272a;border-radius:8px;padding:8px 10px;color:#e4e4e7;cursor:pointer}
.seene-studio-browser button:hover{background:#27272a}
.seene-studio-browser strong{font-weight:600}
.seene-studio-browser span{font-size:11px;color:#71717a;overflow-wrap:anywhere}
.seene-studio-hint{color:#71717a;font-size:12px;padding:6px}
.seene-studio-confirm-actions{display:flex;justify-content:flex-end;gap:8px}
@media(max-width:980px){.seene-studio-sequence{width:220px}.seene-studio-inspector{width:280px}}
`;
