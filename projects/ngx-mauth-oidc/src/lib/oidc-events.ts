export type NgxMAuthOidcEventType =
    | 'token_received'
    | 'token_error'
    | 'token_refreshed'
    | 'token_refresh_error'
    | 'token_validation_error'
    | 'token_expires'
    | 'logout'
    | 'user_profile_loaded'
    | 'user_profile_load_error'
    | 'invalid_nonce_in_state'
    | 'document_loaded'
    | 'document_load_error'
    | 'document_validation_error'
    | 'jwks_load_error'
    | 'silently_refreshed'
    | 'silent_refresh_timeout';

export abstract class NgxMAuthOidcEvent {
    constructor(readonly type: NgxMAuthOidcEventType) {}
}

export class NgxMAuthOidcSuccessEvent extends NgxMAuthOidcEvent {
    constructor(type: NgxMAuthOidcEventType, readonly info: any = null) {
        super(type);
    }
}
export class NgxMAuthOidcInfoEvent extends NgxMAuthOidcEvent {
    constructor(type: NgxMAuthOidcEventType, readonly info: any = null) {
        super(type);
    }
}

export class NgxMAuthOidcErrorEvent extends NgxMAuthOidcEvent {
    constructor(type: NgxMAuthOidcEventType, readonly reason: object, readonly params: object = null) {
        super(type);
    }
}
