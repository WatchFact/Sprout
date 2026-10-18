import {categories,normaliseCategory} from './catalog';
export const licenses=['All rights reserved','CC BY 4.0','CC0'];
export type UploadDefaults={category:string;description:string;license:string;commentsEnabled:boolean};
export const initialDefaults:UploadDefaults={category:'People & Blogs',description:'',license:'All rights reserved',commentsEnabled:true};
export function validateDefaults(data:any):UploadDefaults{
 if(!data||!categories.slice(1).includes(normaliseCategory(data.category))||typeof data.description!=='string'||data.description.length>5000||!licenses.includes(data.license)||typeof data.commentsEnabled!=='boolean')throw Error('Check the category, description, licence and comment setting.');
 return{category:normaliseCategory(data.category),description:data.description,license:data.license,commentsEnabled:data.commentsEnabled};
}
export function parseChapters(text:string){
 if(!text.trim())return[];const lines=text.trim().split('\n');if(lines.length>100)throw Error('Use up to 100 chapters.');let previous=-1;
 return lines.map(line=>{const m=/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+(.+)$/.exec(line.trim());if(!m||Number(m[2])>59||Number(m[3])>59||m[4].length>100)throw Error('Write each chapter as 0:00 Chapter title, in ascending order.');const seconds=Number(m[1]||0)*3600+Number(m[2])*60+Number(m[3]);if(seconds<=previous)throw Error('Chapter times must be strictly ascending.');previous=seconds;return{seconds,title:m[4]}});
}
export function validateVideoDetails(data:any){
 if(!data||typeof data.title!=='string'||!data.title.trim()||data.title.length>150||typeof data.description!=='string'||data.description.length>5000||!categories.slice(1).includes(normaliseCategory(data.category))||!['public','private'].includes(data.visibility)||!licenses.includes(data.license)||typeof data.commentsEnabled!=='boolean'||typeof data.credits!=='string'||data.credits.length>2000||typeof data.chapterText!=='string'||typeof data.tags!=='string')throw Error('Check your video details. Title: 150 characters; description: 5,000; credits: 2,000.');
 const tags=[...new Set<string>(data.tags.split(',').map((s:string)=>s.trim()).filter(Boolean))];if(tags.length>15||tags.some(t=>t.length>30))throw Error('Use up to 15 tags, each no more than 30 characters.');
 return{title:data.title.trim(),description:data.description,category:normaliseCategory(data.category),visibility:data.visibility,license:data.license,commentsEnabled:data.commentsEnabled,credits:data.credits,tags,chapters:parseChapters(data.chapterText)};
}
export const studioFeatures=['Content search','Publication-status filters','Date, title and file-size sorting','Bulk selection','Bulk category editing','CSV metadata export','Bulk deletion with confirmation','Draft uploads','Publish drafts','Public/private video visibility','Video tags','Per-video comment controls','Licences and credits','Replace custom thumbnails','WebVTT captions','Timestamp chapters','Saved upload defaults','Channel comment manager','Download uploaded files','Content and storage dashboard'];

export function formatChapterTime(n:number){const seconds=String(n%60).padStart(2,'0');return n>=3600?Math.floor(n/3600)+':'+String(Math.floor(n/60)%60).padStart(2,'0')+':'+seconds:Math.floor(n/60)+':'+seconds}
