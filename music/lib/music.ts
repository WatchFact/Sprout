export type Track={id:string;moderationCommentsLocked?:boolean;album?:string;lyrics?:string;title:string;artist:string;artistId:string;src:string;cover:string;genre:string;description:string;duration:number;created:number;uploaded?:boolean;license:string;status?:string;moderationReason?:string};
export const genres=['All sounds','Electronic','Ambient','Lo-fi','Hip-hop','Pop','Rock','R&B','Jazz','Classical','Other'];
export const demos:Track[]=[];
export function time(n:number){if(!Number.isFinite(n)||n<0)return '0:00';return Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0')}
