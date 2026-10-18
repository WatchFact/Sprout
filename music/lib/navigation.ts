const videoPages=['Home','Explore','Subscriptions','Library','Watch later','Liked videos','Playlists','History','Your channel','Playlist','Moderation'];
const musicPages=['Discover','Explore','Fresh shuffle','Trending','Liked','Albums','Artists','Uploads','Following','Library','Liked songs','History','Playlists','Your profile','Playlist','Studio','Moderation'];
export function pageHref(page:string,music=false){const home=music?'Discover':'Home';return page===home?'/':!music&&page==='Studio'?'/studio':'/?page='+encodeURIComponent(page)}
export function readRoute(url:URL,music=false,initialChannel=''){
 const q=url.searchParams;const channel=q.get('channel')||((url.pathname.startsWith('/c/')||url.pathname.startsWith('/channel/'))?initialChannel:'');
 const media=q.get(music?'track':'v')||'';const search=q.get('q')||'';const requested=q.get('page')||'';
 const playlist=q.get('playlist')||'';const page=playlist?'Playlist':channel?(music?'Artist':'Channel'):media?(music?'Track':'Watch'):q.has('q')?'Search':!music&&url.pathname==='/studio'?'Studio':(music?musicPages:videoPages).includes(requested)?requested:music?'Discover':'Home';
 return {page,channel,media,search,playlist};
}
