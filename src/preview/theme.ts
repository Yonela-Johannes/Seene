import {studioTheme} from './studio-theme';

export const previewTheme = `
${studioTheme}
[data-seene-preview]{position:fixed;inset:0;height:100dvh;overflow:hidden;background:transparent;color:#fff;min-height:0;width:100%;box-sizing:border-box;isolation:isolate}
.seene-chrome{font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-sizing:border-box;color:#fff}
.seene-viewport{position:absolute;inset:0;background:var(--seene-scene-backdrop, #000);overflow:hidden;display:flex;align-items:center;justify-content:center}
.seene-canvas{flex:none;position:relative;overflow:hidden;background:var(--seene-scene-backdrop, #000)}
.seene-bottom-blur{position:absolute;inset:auto 0 0;height:min(320px,50%);pointer-events:none;z-index:1}
.seene-bottom-blur i{position:absolute;inset:0;pointer-events:none;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);mask-image:linear-gradient(transparent,#000 55%);-webkit-mask-image:linear-gradient(transparent,#000 55%)}
.seene-bottom-blur i:first-child{background:rgb(0 0 0 / .28)}
.seene-bottom-blur i:nth-child(2){top:25%;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);mask-image:linear-gradient(transparent,#000 65%);-webkit-mask-image:linear-gradient(transparent,#000 65%)}
.seene-bottom-blur i:nth-child(3){top:50%;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);mask-image:linear-gradient(transparent,#000 80%);-webkit-mask-image:linear-gradient(transparent,#000 80%)}
.seene-footer{position:absolute;inset:auto 0 0;z-index:2;pointer-events:none;padding:24px max(24px,env(safe-area-inset-right)) max(20px,env(safe-area-inset-bottom)) max(24px,env(safe-area-inset-left));box-sizing:border-box;background:rgba(13,17,25,0.92)}
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
[data-seene-preview] [data-seene-diagnostics]{display:none}
@media(max-width:700px){.seene-footer{padding:12px max(10px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left))}.seene-controls{gap:10px;max-height:calc(100dvh - 24px - env(safe-area-inset-bottom))}.seene-header{gap:8px}.seene-heading{flex-wrap:wrap;gap:8px}.seene-title{flex-basis:100%;font-size:13px}.seene-presentation-rail{justify-content:flex-start}.seene-presentation-note{display:none}.seene-control{padding:10px 14px}.seene-icon{padding:12px}.seene-dock{gap:8px}.seene-time{min-width:76px;font-size:11px}.seene-empty h1{font-size:30px}}
@media(max-height:500px){.seene-footer{padding-top:8px;padding-bottom:max(8px,env(safe-area-inset-bottom))}.seene-controls{gap:8px;max-height:calc(100dvh - 16px - env(safe-area-inset-bottom))}.seene-empty-symbol{display:none}.seene-empty h1{font-size:24px;margin:0 0 8px}}
@media(prefers-reduced-motion:reduce){.seene-control{transition:none}}
`;
