export declare const event: {
    list: Map<any, any>;
    on(eventType: string, eventAction: any): any;
    emit(eventType: string, ...args: any): void;
};
