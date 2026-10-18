'use client';
import {useEffect,useState} from 'react';
export default function NetworkNotice(){const [offline,setOffline]=useState(false);useEffect(()=>{const update=()=>setOffline(!navigator.onLine);update();addEventListener('online',update);addEventListener('offline',update);return()=>{removeEventListener('online',update);removeEventListener('offline',update)}},[]);return offline?<aside className="network-notice" role="status">You’re offline. Reconnect to play, save or upload.</aside>:null}
