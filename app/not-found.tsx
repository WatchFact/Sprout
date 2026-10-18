import {ArrowLeft,Search} from '../components/md2-icons';
export default function NotFound(){return <main className="missing-page"><Search size={44}/><h1>This page isn’t available</h1><p>The link may be incorrect, or the channel may not have a public profile yet.</p><a className="pill green primary" href="/"><ArrowLeft size={18}/>Return to Sprout</a></main>}
