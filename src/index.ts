import VueRouter, { Route } from 'vue-router';
import { VueConstructor, PluginObject } from 'vue';

type UmamiPluginOptions = {
    websiteID: string;
    scriptSrc?: string;
    ignoreLocalhost?: boolean;
    router?: VueRouter;
}

type UmamiPluginQueuedEvent = {
    type: UmamiTrackEvent,
    args: [UmamiTrackEventParams]
} | ((props: UmamiTrackPaveViewOptions) => UmamiTrackPaveViewOptions);

type UmamiTrackEvent = string;

type UmamiTrackEventParams = object;

type UmamiTrackPaveViewOptions = {
    website: string;
    hostname?: string;
    language?: string;
    referrer?: string;
    screen?: string;
    title?: string;
    url?: string;
}

declare global {
    interface Window {
        umami: {
            track: (event: UmamiTrackEvent | ((props: UmamiTrackPaveViewOptions) => UmamiTrackPaveViewOptions), params?: UmamiTrackEventParams) => void;
        };
    }
}

const queuedEvents: UmamiPluginQueuedEvent[] = [];


function isUmaniDisabled(): boolean {
    return localStorage.getItem('umami.disabled') === '1';
}

function isLocalhost(): boolean {
    const hostname: string = location.hostname;
    return hostname === '' || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export const VueUmamiPlugin: PluginObject<UmamiPluginOptions> = {

    install(Vue: VueConstructor, options: UmamiPluginOptions | undefined): void {

        if (!options) {
            throw new Error('Please provide the necessary options for the Umami plugin.');
        }

        const { scriptSrc = 'https://us.umami.is/script.js', websiteID, ignoreLocalhost = false, router }: UmamiPluginOptions = options;
        if (!websiteID) {
            return console.warn('Website ID not provided for Umami plugin, skipping.');
        }

        if (isLocalhost() && ignoreLocalhost) {
            return console.warn('Umami ignores you because you are on localhost');
        }

        if (isUmaniDisabled()) {
            // The script already ignores but let's stop earlier.
            return console.warn('Umami ignores you because umami.disabled is set to 1');
        }
        if (router) {
            attachUmamiToRouter(router);
        }
        onDocumentReady(() => initUmamiScript(scriptSrc, websiteID));
    },

};

function attachUmamiToRouter(router: VueRouter): void {
    router.afterEach((to: Route): void => trackUmamiPageView({ url: to.fullPath }));
}

function onDocumentReady(callback: () => void): void {
    document.readyState !== 'loading'
        ? callback()
        : document.addEventListener('DOMContentLoaded', callback);
}

function initUmamiScript(scriptSrc: string, websiteID: string): void {
    const script: HTMLScriptElement = document.createElement('script');
    script.defer = true;
    script.src = scriptSrc;
    script.onload = (): void => {
        console.log('Umami plugin loaded');
        processQueuedEvents();
    };
    script.setAttribute('data-website-id', websiteID);
    script.setAttribute('data-auto-track', 'false');
    document.head.appendChild(script);
}

function processQueuedEvents(): void {
    while (queuedEvents.length) {
        const item: UmamiPluginQueuedEvent | undefined = queuedEvents.shift();
        if (!item) {
            continue;
        }
        typeof item === 'function'
            ? window.umami.track(item)
            : window.umami.track(item.type, item.args[0]);
    }
}

export function trackUmamiPageView(options?: Partial<UmamiTrackPaveViewOptions>): void {
    const trackPageViewOptionsFn = (props: UmamiTrackPaveViewOptions): UmamiTrackPaveViewOptions => {
        return { ...props, ...options };
    };

    window.umami
        ? window.umami.track(trackPageViewOptionsFn)
        : queuedEvents.push(trackPageViewOptionsFn);
}

export function trackUmamiEvent(event: UmamiTrackEvent, eventParams: UmamiTrackEventParams): void {
    window.umami
        ? window.umami.track(event, eventParams)
        : queuedEvents.push({ type: event, args: [eventParams] });
}
