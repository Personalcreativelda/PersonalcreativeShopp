import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;
const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

function initMetaPixel(id: string) {
  if (window.fbq) return;
  const s = document.createElement('script');
  s.innerHTML = `
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){
    n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];
    t=b.createElement(e);t.async=!0;t.src=v;
    s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
    (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init','${id}');
    fbq('track','PageView');
  `;
  document.head.appendChild(s);
  const ns = document.createElement('noscript');
  ns.innerHTML = `<img height="1" width="1" style="display:none"
    src="https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1"/>`;
  document.body.insertBefore(ns, document.body.firstChild);
}

function initGA(id: string) {
  if (window.gtag) return;
  const s1 = document.createElement('script');
  s1.async = true;
  s1.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(s1);
  const s2 = document.createElement('script');
  s2.innerHTML = `
    window.dataLayer=window.dataLayer||[];
    function gtag(){dataLayer.push(arguments);}
    gtag('js',new Date());
    gtag('config','${id}',{send_page_view:false});
  `;
  document.head.appendChild(s2);
}

export function useAnalytics() {
  const location = useLocation();

  useEffect(() => {
    if (PIXEL_ID) initMetaPixel(PIXEL_ID);
    if (GA_ID) initGA(GA_ID);
  }, []);

  useEffect(() => {
    if (window.fbq && PIXEL_ID) {
      window.fbq('track', 'PageView');
    }
    if (window.gtag && GA_ID) {
      window.gtag('config', GA_ID, {
        page_path: location.pathname + location.search,
      });
    }
  }, [location.pathname, location.search]);
}
