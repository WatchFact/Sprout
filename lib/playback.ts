export type PlaybackProgress={id:string;position:number;at:number;seconds:number;saved:boolean;playing:boolean};
export function advancePlayback(state:PlaybackProgress|undefined,sample:{id:string;position:number;at:number;paused:boolean;seeking:boolean;duration:number;rate?:number}){
 const rate=sample.rate||1;if(!state||state.id!==sample.id)return {id:sample.id,position:sample.position,at:sample.at,seconds:0,saved:false,playing:!sample.paused};
 const elapsed=Math.max(0,(sample.at-state.at)/1000),moved=sample.position-state.position;
 const continuous=state.playing&&!sample.seeking&&elapsed<=10&&moved>0&&moved<=elapsed*rate+1;
 return {...state,playing:!sample.paused,position:sample.position,at:sample.at,seconds:state.seconds+(continuous?Math.min(elapsed,moved/rate):0)};
}
export function playbackQualified(state:PlaybackProgress,duration:number){return !state.saved&&state.seconds>=Math.min(30,Number.isFinite(duration)&&duration>0?duration*.5:30)}
