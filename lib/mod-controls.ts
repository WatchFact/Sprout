export const modControls=[
 'Search content and cases','Filter content type','Filter publication state','Filter report reason','Filter by date','Sort the queue','Preview video or audio','Inspect captions or lyrics','Remove content','Restore content','Bulk remove content','Bulk restore content','Lock media comments','Unlock media comments','Resolve reports','Reopen reports','Dismiss reports','Set report priority','Claim or release reports','Save private case notes','Issue creator warnings','Suspend uploads','Suspend commenting','Suspend profile edits','Lift creator restrictions','Remove a creator’s published content','Pause site uploads','Pause site comments','Read the moderation audit log','Export filtered cases as CSV'
] as const;
export type ModSettings={uploadsPaused:boolean;commentsPaused:boolean};
export const defaultModSettings:ModSettings={uploadsPaused:false,commentsPaused:false};
export const durations=[{label:'1 hour',hours:1},{label:'24 hours',hours:24},{label:'7 days',hours:168},{label:'30 days',hours:720}] as const;
